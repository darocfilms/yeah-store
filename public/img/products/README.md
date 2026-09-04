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

---

## Sección "Detalles del producto"

Debajo de la ficha, dentro de la misma ventana, cada producto puede tener una
sección editorial libre. Se arma con el campo `details` en `/products.json`,
como una lista de bloques que se muestran en el orden que los escribas:

```json
"details": [
  { "type": "heading", "text": "Cómo se instala" },
  { "type": "text",    "text": "Copia el archivo .dctl a la carpeta LUT..." },
  { "type": "image",
    "src": "img/products/halation-antes-despues.jpg",
    "alt": "Comparación antes y después",
    "caption": "Antes / después sobre negativo 500T" },
  { "type": "text", "text": "Otro párrafo, y así cuantos quieras." }
]
```

### Tipos de bloque

| `type`    | Campos                       | Para qué sirve                          |
|-----------|------------------------------|-----------------------------------------|
| `heading` | `text`                       | Subtítulo dentro de la sección          |
| `text`    | `text`                       | Párrafo                                 |
| `image`   | `src`, `alt`, `caption`      | Imagen a ancho completo (`caption` opcional) |

### Sobre las imágenes de esta sección

A diferencia de las de la grilla, **acá no hay restricción de proporción**:
la imagen se muestra tal cual, a ancho completo y con su alto natural. Sirve
igual una panorámica de 1600×600 que una vertical de 700×1300 — no se recorta
nada. Lo único a cuidar es el peso: comprime a JPG antes de subirlas.

Si un producto no tiene `details`, la sección simplemente no aparece.

---

## Pendiente: imágenes de DAROC FX Lab

`products.json` ya declara estas cuatro rutas. Mientras no existan, la tienda
muestra el placeholder con textura diagonal — no se rompe nada, pero el
producto se ve incompleto.

| Archivo | Qué muestra |
|---------|-------------|
| `fx-lab-01.jpg` | Portada del pack: titular y lista de los catorce efectos |
| `fx-lab-02.jpg` | Contact sheet: el mismo plano con los catorce tratamientos |
| `fx-lab-impresion.jpg` | Comparación risograph / semitono / grano de papel |
| `fx-lab-analogico.jpg` | Comparación VHS / CRT / glitch |

Cuadradas, 1600×1600 como máximo, JPG progresivo calidad 82, bajo 400 KB.
