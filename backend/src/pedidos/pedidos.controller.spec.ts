import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

describe('PedidosController', () => {
  let controller: PedidosController;
  let service: jest.Mocked<PedidosService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PedidosController],
      providers: [
        {
          provide: PedidosService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            toggleRetencion: jest.fn(),
            cambiarEstado: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PedidosController);
    service = module.get(PedidosService);
  });

  describe('findAll (validación tienda_id)', () => {
    const validUuid = '00000000-0000-0000-0000-000000000001';

    it('llama al service cuando tienda_id es un UUID válido', async () => {
      await controller.findAll(validUuid);
      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ tienda_id: validUuid }),
      );
    });

    it('rechaza cuando tienda_id no está presente', () => {
      expect(() => controller.findAll(undefined as unknown as string)).toThrow(
        BadRequestException,
      );
      expect(service.findAll).not.toHaveBeenCalled();
    });

    it('rechaza cuando tienda_id es un string vacío', () => {
      expect(() => controller.findAll('')).toThrow(BadRequestException);
      expect(service.findAll).not.toHaveBeenCalled();
    });

    it('rechaza cuando tienda_id no es un UUID válido', () => {
      expect(() => controller.findAll('not-a-uuid')).toThrow(BadRequestException);
      expect(() => controller.findAll('12345')).toThrow(BadRequestException);
      expect(() => controller.findAll("'; DROP TABLE pedidos;--")).toThrow(
        BadRequestException,
      );
      expect(service.findAll).not.toHaveBeenCalled();
    });

    it('parsea limit y offset a número', async () => {
      await controller.findAll(validUuid, undefined, undefined, undefined, undefined, '50', '10');
      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50, offset: 10 }),
      );
    });

    it('pasa filtros opcionales al service', async () => {
      await controller.findAll(validUuid, 'ENTREGADO', 'prod-1', '2026-01-01', '2026-12-31');
      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: 'ENTREGADO',
          producto_id: 'prod-1',
          fecha_desde: '2026-01-01',
          fecha_hasta: '2026-12-31',
        }),
      );
    });
  });
});
