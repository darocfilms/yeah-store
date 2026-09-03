# Imágenes de producto

Cada producto en `/products.json` acepta tres campos opcionales de imagen.
Las rutas van **relativas a `public/`**:

```json
{
  "image":      "img/products/halation-01.jpg",   // imagen en reposo
  "imageHover": "img/products/halation-02.jpg",   // se revela al pasar el mouse
  "gallery": [                                     // galería del modal
    "img/products/halation-01.jpg",
    "img/products/halation-02.jpg",
    "img/products/halation-03.jpg",
    "img/products/halation-04.jpg"
  ]
}
```

Los tres campos son opcionales y se pueden mezclar: un producto sin `image`
sigue mostrando el bloque placeholder con textura diagonal, así que puedes
cargar las fotos de a poco sin romper nada.

## Recomendaciones

- **Formato**: cuadrado (1:1) para la grilla — se recorta con `object-fit: cover`.
- **Tamaño**: 1000×1000 px basta; más grande solo hace la página más lenta.
- **Peso**: comprime a JPG de calidad ~80 (apunta a menos de 300 KB por imagen).
- La galería del modal admite cualquier cantidad de imágenes, no solo 4.
