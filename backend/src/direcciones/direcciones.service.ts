import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';

const MODEL = 'claude-haiku-4-5';

/**
 * Provincias del Ecuador. El parser se limita a este set para ser
 * determinista.
 */
const PROVINCIAS_EC = [
  'Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi',
  'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas', 'Imbabura', 'Loja',
  'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza',
  'Pichincha', 'Santa Elena', 'Santo Domingo de los Tsáchilas',
  'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe',
] as const;

export interface DireccionParseada {
  provincia: string | null;
  canton: string | null;
  sector: string | null;
  referencia: string | null;
  completa: boolean;
  /** Razones por las que la dirección se considera incompleta/riesgosa. */
  problemas: string[];
  /** Versión normalizada y limpia del texto original. */
  normalizada: string;
}

@Injectable()
export class DireccionesService {
  private readonly log = new Logger(DireccionesService.name);
  private readonly client: Anthropic | null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      this.client = null;
      this.log.warn('ANTHROPIC_API_KEY no configurada — parser en modo fallback');
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /**
   * Analiza un texto de dirección en español (ej. "por la fe frente al
   * abasto Claudia, Guayaquil") y extrae sus componentes + detecta si
   * está incompleta. Si la IA falla o no está habilitada, devuelve un
   * fallback heurístico.
   */
  async parse(texto: string): Promise<DireccionParseada> {
    const raw = (texto ?? '').trim();
    if (!raw) {
      return {
        provincia: null, canton: null, sector: null, referencia: null,
        completa: false, problemas: ['Dirección vacía'], normalizada: '',
      };
    }

    if (!this.client) return this.fallbackHeuristic(raw);

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 512,
        system:
          'Eres un parser de direcciones del Ecuador. Recibes texto libre en español ' +
          '(cliente hablando, sin estructura) y extraes los componentes: provincia, ' +
          'cantón (ciudad principal), sector/barrio, referencia. Detectas si la dirección ' +
          'es insuficiente para que un courier la encuentre.\n\n' +
          'Provincias válidas del Ecuador: ' + PROVINCIAS_EC.join(', ') + '.\n' +
          'Si el texto menciona una provincia o ciudad fuera del Ecuador, marca completa=false con un problema.\n' +
          'Una dirección SE CONSIDERA COMPLETA cuando tiene AL MENOS: provincia O cantón, más una referencia/sector identificable.\n' +
          'Problemas típicos: falta número de casa, falta calle principal, solo referencias vagas ("por la iglesia"), provincia ambigua.',
        messages: [
          {
            role: 'user',
            content: `Dirección a analizar:\n"${raw}"\n\nResponde con el JSON pedido.`,
          },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                provincia:   { type: ['string', 'null'] },
                canton:      { type: ['string', 'null'] },
                sector:      { type: ['string', 'null'] },
                referencia:  { type: ['string', 'null'] },
                completa:    { type: 'boolean' },
                problemas:   { type: 'array', items: { type: 'string' } },
                normalizada: { type: 'string' },
              },
              required: ['provincia','canton','sector','referencia','completa','problemas','normalizada'],
              additionalProperties: false,
            },
          },
        },
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        this.log.warn('Respuesta de Claude sin bloque de texto');
        return this.fallbackHeuristic(raw);
      }

      const parsed = JSON.parse(textBlock.text) as DireccionParseada;
      // Sanitizar por si la IA devuelve provincia no EC
      if (parsed.provincia && !(PROVINCIAS_EC as readonly string[]).includes(parsed.provincia)) {
        parsed.problemas = [...(parsed.problemas ?? []), `Provincia "${parsed.provincia}" no reconocida en Ecuador`];
        parsed.provincia = null;
        parsed.completa = false;
      }
      return parsed;
    } catch (err) {
      this.log.error('Fallo llamando a Claude para parsear dirección', err as Error);
      return this.fallbackHeuristic(raw);
    }
  }

  /**
   * Fallback sin IA: reglas básicas para detectar provincia y marcar
   * incompleta si es muy corta.
   */
  private fallbackHeuristic(raw: string): DireccionParseada {
    const lower = raw.toLowerCase();
    let provincia: string | null = null;
    for (const p of PROVINCIAS_EC) {
      if (lower.includes(p.toLowerCase())) { provincia = p; break; }
    }

    const problemas: string[] = [];
    if (raw.length < 15) problemas.push('Dirección muy corta (<15 caracteres)');
    if (!/\d/.test(raw)) problemas.push('Sin número visible (ej. número de casa, torre, lote)');
    if (!provincia) problemas.push('No se identificó la provincia');

    return {
      provincia,
      canton: null,
      sector: null,
      referencia: null,
      completa: problemas.length === 0,
      problemas,
      normalizada: raw,
    };
  }
}
