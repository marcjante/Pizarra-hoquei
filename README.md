# Pizarra Táctica – Hoquei Patines Palau-Solità i Plegamants

Pizarra táctica interactiva para hockey patines: colocación de jugadores, dibujo de jugadas, animación y exportación a JPG/vídeo.

## Archivos

- `index.html` — estructura de la página
- `style.css` — estilos
- `script.js` — lógica de la pizarra (dibujo, jugadores, animación, exportación)

## Subir el proyecto a GitHub

### 1. Crear el repositorio

1. Entra en [github.com](https://github.com) y pulsa **New repository**.
2. Ponle un nombre, por ejemplo `pizarra-hockey`.
3. Déjalo público si quieres usar GitHub Pages gratis.
4. No añadas README ni .gitignore desde la web (ya los tienes aquí).
5. Pulsa **Create repository**.

### 2. Subir los archivos desde tu ordenador

Con Git instalado, desde la carpeta donde tengas estos tres archivos:

```bash
git init
git add index.html style.css script.js README.md
git commit -m "Primera versión de la pizarra táctica"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/pizarra-hockey.git
git push -u origin main
```

Sustituye `TU_USUARIO` y `pizarra-hockey` por tu usuario y el nombre real del repositorio.

### 3. Alternativa sin terminal (subida web)

1. Abre el repositorio en GitHub.
2. Pulsa **Add file → Upload files**.
3. Arrastra `index.html`, `style.css` y `script.js`.
4. Escribe un mensaje de commit y pulsa **Commit changes**.

### 4. Publicarlo online con GitHub Pages (opcional)

Para tener una URL pública tipo `https://TU_USUARIO.github.io/pizarra-hockey/`:

1. En el repositorio, ve a **Settings → Pages**.
2. En **Source**, elige la rama `main` y la carpeta `/ (root)`.
3. Guarda. En un minuto o dos, GitHub te dará el enlace público.
4. Cada vez que subas cambios a `main`, la página se actualiza sola.

## Notas

- No hace falta servidor ni build: son archivos estáticos, funciona directo en el navegador o en GitHub Pages.
- La exportación a vídeo usa la API `MediaRecorder` del navegador; funciona en Chrome/Edge/Firefox de escritorio y en Chrome Android. En iOS Safari puede no estar disponible.
