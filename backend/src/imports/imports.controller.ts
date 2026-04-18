import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post('rocket-excel')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async importRocketExcel(
    @UploadedFile() file: MulterFile,
    @Query('tienda_id') tiendaId: string,
  ) {
    if (!tiendaId || !UUID_REGEX.test(tiendaId)) {
      throw new BadRequestException('tienda_id es requerido y debe ser un UUID válido');
    }
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Archivo Excel vacío o no provisto (campo "file")');
    }
    return this.imports.importRocketExcel(tiendaId, file.buffer);
  }

  @Get('producto-aliases')
  listAliases(@Query('tienda_id') tiendaId: string) {
    if (!tiendaId || !UUID_REGEX.test(tiendaId)) {
      throw new BadRequestException('tienda_id es requerido y debe ser un UUID válido');
    }
    return this.imports.listAliasesExistentes(tiendaId);
  }

  @Post('producto-aliases')
  crearAlias(
    @Body()
    body: { tienda_id: string; alias_externo: string; producto_id: string },
  ) {
    if (!body?.tienda_id || !UUID_REGEX.test(body.tienda_id)) {
      throw new BadRequestException('tienda_id es requerido y debe ser un UUID válido');
    }
    if (!body.alias_externo || !body.producto_id) {
      throw new BadRequestException('alias_externo y producto_id son requeridos');
    }
    return this.imports.crearAlias(body.tienda_id, body.alias_externo, body.producto_id);
  }

  @Delete('producto-aliases/:id')
  eliminarAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tienda_id') tiendaId: string,
  ) {
    if (!tiendaId || !UUID_REGEX.test(tiendaId)) {
      throw new BadRequestException('tienda_id es requerido y debe ser un UUID válido');
    }
    return this.imports.eliminarAlias(id, tiendaId);
  }
}
