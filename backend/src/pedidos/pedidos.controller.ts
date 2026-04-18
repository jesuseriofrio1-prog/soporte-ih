import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';

@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Get()
  findAll(
    @Query('tienda_id') tienda_id: string,
    @Query('estado') estado?: string,
    @Query('producto_id') producto_id?: string,
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // Validar tienda_id: requerido y formato UUID
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!tienda_id || !UUID_REGEX.test(tienda_id)) {
      throw new BadRequestException('tienda_id es requerido y debe ser un UUID válido');
    }

    return this.pedidosService.findAll({
      tienda_id,
      estado,
      producto_id,
      fecha_desde,
      fecha_hasta,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pedidosService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePedidoDto) {
    return this.pedidosService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePedidoDto,
  ) {
    return this.pedidosService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.pedidosService.remove(id);
  }

  @Patch(':id/retencion')
  toggleRetencion(@Param('id', ParseUUIDPipe) id: string) {
    return this.pedidosService.toggleRetencion(id);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoDto,
  ) {
    return this.pedidosService.cambiarEstado(id, dto);
  }
}
