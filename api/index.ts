// Entrada serverless unificada para Vercel.
//
// El frontend Vue y el backend NestJS viven en el mismo proyecto Vercel:
// los archivos estáticos se sirven desde frontend/dist y las rutas /api/*
// caen aquí. Este archivo es un wrapper minimalista que reexporta el
// handler del backend ya compilado (backend/dist/api/index.js), generado
// por `npm run build:backend` antes de empaquetar la función serverless.
//
// Evitamos importar la fuente TS con decoradores directamente para no
// depender del compilador de decoradores de @vercel/node.

// @ts-ignore -- backend/dist se genera en el buildCommand antes de empaquetar
export { default } from '../backend/dist/api/index';
