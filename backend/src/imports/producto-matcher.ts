import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Candidato local del catálogo para matching.
 */
export interface MatchCandidate {
  id: string;
  nombre: string;
}

/**
 * Resultado de un match AI para un único nombre externo.
 */
export interface AIMatchResult {
  external_name: string;
  producto_id: string | null;
  confidence: number; // 0-100
}

const MODEL = 'claude-haiku-4-5';

/**
 * Servicio que usa Claude Haiku para emparejar nombres de productos externos
 * (ej. del Excel de Rocket) con productos locales del catálogo de Soporte IH.
 *
 * Se llama SÓLO cuando los matches exactos y por alias ya fallaron. Hace un
 * único request batch con todos los nombres no mapeados — económico y rápido.
 *
 * Si ANTHROPIC_API_KEY no está seteada, se comporta como no-op (devuelve todos
 * los resultados con producto_id=null, confidence=0) para que la importación
 * siga funcionando sin IA.
 */
@Injectable()
export class ProductoMatcherAI {
  private readonly log = new Logger(ProductoMatcherAI.name);
  private readonly client: Anthropic | null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      this.client = null;
      this.log.warn(
        'ANTHROPIC_API_KEY no está configurada; el matching por IA queda deshabilitado.',
      );
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /**
   * Empareja una lista de nombres externos con el catálogo local en una
   * única llamada a la API. Devuelve un array del mismo largo que
   * `externalNames`, en el mismo orden.
   */
  async matchBatch(
    catalog: MatchCandidate[],
    externalNames: string[],
  ): Promise<AIMatchResult[]> {
    if (externalNames.length === 0) return [];

    const empty = (name: string): AIMatchResult => ({
      external_name: name,
      producto_id: null,
      confidence: 0,
    });

    if (!this.client || catalog.length === 0) {
      return externalNames.map((n) => empty(n));
    }

    const catalogText = catalog
      .map((p, i) => `[${i}] ${p.nombre}`)
      .join('\n');
    const externalText = externalNames
      .map((n, i) => `[${i}] ${n}`)
      .join('\n');

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system:
          'Eres un matcher de productos entre dos sistemas de e-commerce en español. ' +
          'Recibirás un catálogo local numerado y una lista de productos externos. ' +
          'Por cada producto externo, identifica el índice del producto local que mejor lo representa. ' +
          'Si ningún producto es razonablemente equivalente, devuelve local_index=null con confidence=0.\n' +
          'Escala de confianza: 95-100 coincidencia casi idéntica, 70-94 equivalente claro aunque con variaciones (plural, mayúsculas, palabras descriptivas extra), 40-69 relacionado pero incierto, 0-39 no es el mismo producto.',
        messages: [
          {
            role: 'user',
            content:
              `Catálogo local:\n${catalogText}\n\n` +
              `Productos externos a emparejar:\n${externalText}\n\n` +
              'Responde con el JSON pedido.',
          },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                matches: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      external_index: { type: 'integer' },
                      local_index: { type: ['integer', 'null'] },
                      confidence: { type: 'integer' },
                    },
                    required: ['external_index', 'local_index', 'confidence'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['matches'],
              additionalProperties: false,
            },
          },
        },
      });

      // Extrae el primer bloque de texto — con output_config.format el primer
      // bloque es JSON válido garantizado por la API.
      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        this.log.warn('Respuesta de Claude sin bloque de texto');
        return externalNames.map((n) => empty(n));
      }

      const parsed = JSON.parse(textBlock.text) as {
        matches: Array<{
          external_index: number;
          local_index: number | null;
          confidence: number;
        }>;
      };

      return externalNames.map((externalName, externalIdx) => {
        const m = parsed.matches.find((x) => x.external_index === externalIdx);
        if (!m || m.local_index === null) return empty(externalName);

        const prod = catalog[m.local_index];
        if (!prod) return empty(externalName);

        const confidence = Math.max(0, Math.min(100, Math.round(m.confidence)));
        return {
          external_name: externalName,
          producto_id: prod.id,
          confidence,
        };
      });
    } catch (err) {
      // No rompemos la importación si la IA falla; degradamos a sin match.
      this.log.error('Fallo llamando a Claude para matching', err as Error);
      return externalNames.map((n) => empty(n));
    }
  }
}
