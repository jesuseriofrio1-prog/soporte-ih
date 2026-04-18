import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/create-template.dto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('templates')
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get()
  listar(
    @Query('tienda_id') tiendaId: string,
    @Query('activos') activos?: string,
  ) {
    if (!tiendaId || !UUID_REGEX.test(tiendaId)) {
      throw new BadRequestException('tienda_id es requerido y debe ser UUID válido');
    }
    return this.service.listar(tiendaId, activos === 'true');
  }

  @Post()
  crear(@Body() dto: CreateTemplateDto) {
    return this.service.crear(dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tienda_id') tiendaId: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    if (!tiendaId || !UUID_REGEX.test(tiendaId)) {
      throw new BadRequestException('tienda_id es requerido y debe ser UUID válido');
    }
    return this.service.actualizar(id, tiendaId, dto);
  }

  @Delete(':id')
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tienda_id') tiendaId: string,
  ) {
    if (!tiendaId || !UUID_REGEX.test(tiendaId)) {
      throw new BadRequestException('tienda_id es requerido y debe ser UUID válido');
    }
    return this.service.eliminar(id, tiendaId);
  }
}
