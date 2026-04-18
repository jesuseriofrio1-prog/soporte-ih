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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductosService } from './productos.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Get()
  findAll(
    @Query('tienda_id') tienda_id: string,
    @Query('activo') activo?: string,
  ) {
    // Convertir query param string a boolean (default: true)
    const activoBool = activo === undefined ? true : activo === 'true';
    return this.productosService.findAll(tienda_id, activoBool);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productosService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductoDto) {
    return this.productosService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductoDto,
  ) {
    return this.productosService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productosService.remove(id);
  }

  /**
   * Sube una foto del producto. multipart/form-data con campo `file`.
   * Max 5 MB, formatos jpg/png/webp/gif.
   */
  @Post(':id/foto')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 6 * 1024 * 1024 } }))
  subirFoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: MulterFile,
  ) {
    return this.productosService.subirFoto(id, file);
  }

  @Delete(':id/foto')
  borrarFoto(@Param('id', ParseUUIDPipe) id: string) {
    return this.productosService.borrarFoto(id);
  }
}
