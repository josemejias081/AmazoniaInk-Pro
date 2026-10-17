# AmazoniaInk Pro

Aplicación web de preimpresión para preparar diseños destinados a DTF, sublimación y serigrafía. Permite editar imágenes en el navegador y exportarlas como PNG, SVG y fotolitos.

## Requisitos

- Node.js 18 o superior
- npm
- Un navegador web moderno

## Instalación y ejecución

En una terminal, cambia a la carpeta del proyecto antes de ejecutar los comandos:

```bash
cd ruta/a/la/carpeta-del-proyecto
npm install
npm run dev
```

Abre en el navegador la dirección local que muestra Vite (normalmente `http://localhost:5173/`).

Para generar una compilación de producción:

```bash
npm run build
```

Para previsualizar esa compilación localmente:

```bash
npm run preview
```

## Publicación en GitHub Pages

El proyecto incluye un workflow de GitHub Actions que compila y publica el sitio en GitHub Pages cuando se hace `push` a la rama `main`. La configuración de Vite usa la ruta del repositorio `AmazoniaInk-Pro` (respetando mayúsculas y minúsculas).

1. Sube el proyecto a un repositorio público de GitHub llamado `amazoniaink-pro`.
2. En el repositorio, abre **Settings → Pages** y selecciona **GitHub Actions** como origen del despliegue.
3. Haz `push` a la rama `main` o ejecuta manualmente el workflow **Deploy to GitHub Pages** desde la pestaña **Actions**.
4. Cuando finalice el workflow, GitHub mostrará el enlace público del sitio en **Settings → Pages**. Para una cuenta personal, tendrá el formato `https://<usuario>.github.io/amazoniaink-pro/`.

## Resumen de herramientas incluidas

1. **Quitar fondo y Knockout DTF**: selecciona el color con el cuentagotas sobre el lienzo o el selector de color. El modo **Solo Exterior** elimina las zonas conectadas al borde y conserva las áreas interiores del mismo color; **Knockout Total** busca el color en toda la imagen. Incluye tolerancia, suavizado, contracción de borde (*Choke*) y herramientas manuales para borrar o restaurar.
2. **Semitonos (Halftone)**: ofrece **Knockout de Sombra DTF**, **Fotolito Monocromo** y **Cuatricromía CMYK simulada**. Se pueden ajustar el tamaño del punto (indicado también como LPI aproximado), los ángulos disponibles (15°, 22.5°, 45° y 75°) y la geometría (círculo, diamante, línea o cruz).
3. **Vectorización y separación de colores**: reduce la imagen a capas de color que se pueden mostrar u ocultar. Permite descargar un SVG vectorial por capas y fotolitos individuales en PNG negro con marcas de registro.
4. **Escalado, resolución y modo espejo**: configura dimensiones en centímetros o pulgadas y resolución de salida de 150, 300 o 600 DPI. Incluye formatos preestablecidos para pecho izquierdo, A4, A3, A3+, rollos DTF de 30 cm y 60 cm, además del volteo horizontal para modo espejo.
5. **Exportación**: descarga el diseño como PNG y configura el tamaño, DPI, modo espejo y marcas de registro desde el centro de exportación.

## Uso básico

1. Sube una imagen PNG, JPEG o WebP, o selecciona uno de los diseños de ejemplo.
2. Usa las pestañas del flujo de trabajo para quitar el fondo, aplicar semitonos, vectorizar o ajustar el tamaño.
3. Pulsa **Fijar en lienzo** o **Aplicar** en las herramientas correspondientes para incorporar los cambios al diseño.
4. Descarga el PNG, SVG o los fotolitos que necesites.

## Tecnologías

- React
- Vite
- Tailwind CSS
- lucide-react

El procesamiento de imágenes se realiza en el navegador; no se necesita un servicio backend para ejecutar la aplicación.
