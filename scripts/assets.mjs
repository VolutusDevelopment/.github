/**
 * Genera las imágenes de profile/README.md a partir de la landing de Volutus.
 *
 * GitHub no deja CSS ni JavaScript en un README, así que lo que en la landing
 * es estilo aquí es imagen: los botones, los títulos de sección, el logotipo,
 * los glifos de los servicios, el podio y la portada animada. Cada botón es un
 * PNG aparte y en el README va dentro de su propio enlace: una imagen, un
 * destino. Botones y títulos salen en dos versiones, para el tema claro y el
 * oscuro de GitHub (`<picture>` en el README).
 *
 * Necesita, al lado de este repo, ../VolutusLandingPage con `pnpm install`
 * hecho (usa su Playwright y su Archivo itálica), y Python con Pillow, que arma
 * el GIF (portada-gif.py). Lo demás lo lee en vivo de volutus.cl.
 *
 *   node scripts/assets.mjs
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LANDING = resolve(REPO, '..', 'VolutusLandingPage')
const SALIDA = join(REPO, 'profile', 'assets')
const SITIO = 'https://volutus.cl/'

const { chromium } = createRequire(join(LANDING, 'package.json'))('playwright')

// Los tokens de src/styles/index.css de la landing: `claro` es .zona-cielo y
// `oscuro`, .zona-plano (el contorno del secundario, como en
// `.zona-plano .boton-secundario`).
const TEMAS = {
  claro: { texto: '#0a1a2a', linea: '#d6e2ec', accion: '#116492', sobreAccion: '#ffffff' },
  oscuro: { texto: '#e6eef6', linea: 'rgb(230 238 246 / 0.35)', accion: '#38a9e8', sobreAccion: '#0a1a2a' },
}

// [archivo, texto, estilo, ícono]. El texto es el del botón de la landing que
// hace lo mismo.
const BOTONES = [
  ['cuentanos', 'Cuéntanos tu proyecto', 'primario'],
  ['servicios', 'Ver todos los servicios', 'secundario'],
  ['abrir-sitio', 'Abrir el sitio', 'primario'],
  ['ver-codigo', 'Ver el código', 'secundario'],
  ['ver-publicacion', 'Ver la publicación', 'secundario'],
  ['escribenos', 'Escríbenos', 'primario'],
  ['whatsapp', 'WhatsApp', 'secundario', 'whatsapp'],
]

// Los h2.titular de la portada.
const TITULOS = [
  ['servicios', 'Nuestros servicios'],
  ['proyectos', 'Proyectos y logros'],
  ['contacto', '¿Y en tu negocio, cómo sería?'],
]

// El orden de SERVICIOS en src/lib/servicios.js: así salen los glifos.
const SERVICIOS = ['web', 'gestion', 'automatizacion', 'tienda', 'agente', 'app', 'prospeccion', 'datos']

// La portada: ancho de la ventana y franja que se recorta, en px de CSS.
const PORTADA = { ancho: 1000, alto: 640, desde: 70, hasta: 600 }
// Cada cuánto se fotografía el cambio de palabra y cuánto se queda quieta.
const PASO = 40
const QUIETA = 2000

const base64 = (ruta) => readFileSync(ruta).toString('base64')
const carpeta = (...partes) => {
  const ruta = join(SALIDA, ...partes)
  mkdirSync(ruta, { recursive: true })
  return ruta
}
const dosCuadros = (page) =>
  page.evaluate(() => new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo))))

// Todo invisible menos lo marcado con `data-captura`, sobre fondo transparente.
const SOLO_LO_MARCADO = `
  html, body { background: transparent !important; }
  body * { visibility: hidden !important; }
  [data-captura], [data-captura] * { visibility: visible !important; }
`

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })

/* ---------- botones, títulos y logotipo, con la fuente de la landing ---------- */

async function piezasLocales(logotipoSvg) {
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1400, height: 600 } })
  const archivo = base64(join(LANDING, 'public', 'fonts', 'archivo-italica-latin.woff2'))
  const whatsapp = base64(join(LANDING, 'public', 'image', 'whatsapp.webp'))
  await page.setContent(`<style>
    @font-face { font-family: 'Archivo'; font-style: italic; font-weight: 800; src: url(data:font/woff2;base64,${archivo}) format('woff2'); }
    html, body { margin: 0; background: transparent; }
    body { padding: 24px; }
    .boton { display: inline-flex; align-items: center; justify-content: center; gap: 8px; box-sizing: border-box;
      min-height: 44px; padding: 0 24px; border: 1px solid transparent; border-radius: 999px;
      font: italic 800 17px 'Archivo', sans-serif; letter-spacing: 0.01em; white-space: nowrap; }
    .primario { background: var(--accion); color: var(--sobre-accion); }
    .secundario { border-color: var(--linea); color: var(--texto); }
    .boton img { width: 22px; height: 22px; }
    .titular { display: inline-block; padding: 0.08em 0.14em 0.12em 0; color: var(--texto);
      font: italic 800 52px/1.05 'Archivo', sans-serif; letter-spacing: -0.01em; white-space: nowrap; }
    .logotipo { display: block; width: 1200px; height: auto; color: var(--texto); }
  </style><div id="pieza"></div>`)

  const pintar = async (tema, html, ruta) => {
    const t = TEMAS[tema]
    await page.evaluate(
      ({ html, t }) => {
        const pieza = document.getElementById('pieza')
        pieza.style.cssText = `--texto:${t.texto};--linea:${t.linea};--accion:${t.accion};--sobre-accion:${t.sobreAccion};display:inline-block`
        pieza.innerHTML = html
        return document.fonts.ready
      },
      { html, t },
    )
    const elemento = page.locator('#pieza > *')
    await elemento.screenshot({ path: ruta, omitBackground: true })
    const caja = await elemento.boundingBox()
    return `${Math.round(caja.width)}×${Math.round(caja.height)}`
  }

  const medidas = {}
  for (const tema of Object.keys(TEMAS)) {
    for (const [id, texto, estilo, icono] of BOTONES) {
      const imagen = icono ? `<img src="data:image/webp;base64,${whatsapp}" alt="">` : ''
      medidas[`botones/${id}`] = await pintar(tema, `<span class="boton ${estilo}">${imagen}${texto}</span>`, join(carpeta('botones'), `${id}-${tema}.png`))
    }
    for (const [id, texto] of TITULOS) {
      medidas[`titulos/${id}`] = await pintar(tema, `<span class="titular">${texto}</span>`, join(carpeta('titulos'), `${id}-${tema}.png`))
    }
    medidas.logotipo = await pintar(tema, logotipoSvg.replace('<svg', '<svg class="logotipo"'), join(SALIDA, `logotipo-${tema}.png`))
  }
  await page.close()
  return medidas
}

/* ---------- lo que se fotografía de volutus.cl ---------- */

async function piezasDelSitio() {
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  await page.goto(SITIO, { waitUntil: 'networkidle' })
  await page.waitForTimeout(4500)
  await page.addStyleTag({ content: '.barra { visibility: hidden !important; }' })

  const logotipoSvg = await page.evaluate(() => {
    const svg = document.querySelector('.pie-logotipo-svg').cloneNode(true)
    svg.removeAttribute('class')
    return svg.outerHTML
  })

  // Una pieza sola, sin lo que tiene detrás, con aire para su sombra.
  const sola = async (locator, ruta, margen = 8) => {
    await locator.scrollIntoViewIfNeeded()
    await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(400)
    await locator.evaluate((el) => el.setAttribute('data-captura', ''))
    const estilo = await page.addStyleTag({ content: SOLO_LO_MARCADO })
    await dosCuadros(page)
    const caja = await locator.boundingBox()
    await page.screenshot({
      path: ruta,
      omitBackground: true,
      clip: { x: caja.x - margen, y: caja.y - margen, width: caja.width + margen * 2, height: caja.height + margen * 2 },
    })
    await estilo.evaluate((el) => el.remove())
    await locator.evaluate((el) => el.removeAttribute('data-captura'))
  }

  // Una pieza con su fondo, tal como se ve.
  const entera = async (locator, ruta) => {
    await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(800)
    await locator.screenshot({ path: ruta })
  }

  const glifos = page.locator('.servicio-icono')
  for (const [i, id] of SERVICIOS.entries()) await sola(glifos.nth(i), join(carpeta('servicios'), `${id}.png`))

  const obras = page.locator('.obra')
  await sola(obras.nth(0).locator('.obra-nombre > :first-child'), join(carpeta('proyectos'), 'ponlenota-logo.png'), 14)
  await entera(page.locator('.podio-marco'), join(carpeta('proyectos'), 'podio.png'))

  // La vitrina de PonleNota desde el borde de su pantalla: más arriba solo hay
  // lámina vacía.
  const vitrina = page.locator('.obra-con-vitrina .vitrina')
  await vitrina.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(800)
  const caja = await vitrina.boundingBox()
  const arriba = (await vitrina.locator('.vitrina-pantalla').boundingBox()).y - 24
  await page.screenshot({
    path: join(carpeta('proyectos'), 'ponlenota.png'),
    clip: { x: caja.x, y: arriba, width: caja.width, height: caja.y + caja.height - arriba },
  })

  await page.close()
  return logotipoSvg
}

/* ---------- la portada: la nube quieta y la palabra que rota ---------- */

async function portada() {
  const cuadros = mkdtempSync(join(tmpdir(), 'volutus-portada-'))
  const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: PORTADA.ancho, height: PORTADA.alto } })
  await page.goto(SITIO, { waitUntil: 'networkidle' })
  // La bienvenida tapa la página 4 s.
  await page.waitForTimeout(5500)
  await page.addStyleTag({ content: '.barra, .portada-acciones { visibility: hidden !important; }' })

  // El sitio rota la palabra con un setInterval: se apagan todos y la rotación
  // la hace esto, cuadro a cuadro, con las mismas clases y el mismo CSS.
  await page.evaluate(() => {
    const ultimo = setInterval(() => {}, 1e6)
    for (let i = 0; i <= ultimo; i++) clearInterval(i)
  })
  await page.waitForTimeout(1200)
  const palabras = await page.evaluate(() => {
    const rotativo = document.querySelector('.rotativo')
    const palabras = rotativo.dataset.palabras.split('|')
    const colores = rotativo.dataset.colores.split('|')
    // Igual que enLetras en src/titular-rotativo.js.
    const enLetras = (texto, color) => {
      const palabra = document.createElement('span')
      palabra.className = 'rotativo-palabra'
      palabra.style.setProperty('--servicio', color)
      let indice = 0
      for (const caracter of texto) {
        if (caracter === ' ') {
          palabra.append(' ')
          continue
        }
        const letra = document.createElement('span')
        letra.className = 'rotativo-letra'
        letra.style.setProperty('--i', indice++)
        letra.textContent = caracter
        palabra.append(letra)
      }
      return palabra
    }
    window.rotar = {
      quieta: (i) => rotativo.replaceChildren(enLetras(palabras[i], colores[i])),
      // Pausa el cambio de i a la siguiente y devuelve cuánto dura.
      cambio: (i) => {
        const j = (i + 1) % palabras.length
        const sale = enLetras(palabras[i], colores[i])
        const entra = enLetras(palabras[j], colores[j])
        sale.classList.add('rotativo-sale')
        entra.classList.add('rotativo-entra')
        rotativo.replaceChildren(sale, entra)
        window.animaciones = rotativo.getAnimations({ subtree: true })
        window.animaciones.forEach((a) => a.pause())
        const letras = Math.max(...[palabras[i], palabras[j]].map((p) => p.replaceAll(' ', '').length))
        return 600 + 25 * (letras - 1)
      },
      en: (ms) => window.animaciones.forEach((a) => (a.currentTime = ms)),
    }
    return palabras
  })

  // El fondo: todo menos la palabra.
  await page.evaluate(() => {
    window.rotar.quieta(0)
    document.querySelector('.rotativo').style.visibility = 'hidden'
  })
  await dosCuadros(page)
  const recorte = { x: 0, y: PORTADA.desde, width: PORTADA.ancho, height: PORTADA.hasta - PORTADA.desde }
  await page.screenshot({ path: join(cuadros, 'fondo.png'), clip: recorte })

  // La palabra sola, sobre transparente.
  await page.evaluate(() => {
    const rotativo = document.querySelector('.rotativo')
    rotativo.style.visibility = ''
    rotativo.setAttribute('data-captura', '')
  })
  await page.addStyleTag({ content: SOLO_LO_MARCADO })
  const caja = await page.locator('.rotativo').boundingBox()
  const zona = {
    x: Math.floor(caja.x),
    y: Math.floor(caja.y),
    width: Math.ceil(caja.x + caja.width) - Math.floor(caja.x),
    height: Math.ceil(caja.y + caja.height) - Math.floor(caja.y),
  }
  const lista = []
  const foto = async (archivo, ms) => {
    await dosCuadros(page)
    await page.screenshot({ path: join(cuadros, archivo), clip: zona, omitBackground: true })
    lista.push({ archivo, ms })
  }
  for (let i = 0; i < palabras.length; i++) {
    await page.evaluate((i) => window.rotar.quieta(i), i)
    await foto(`quieta-${i}.png`, QUIETA)
    const duracion = await page.evaluate((i) => window.rotar.cambio(i), i)
    for (let ms = PASO, k = 0; ms < duracion; ms += PASO, k++) {
      await page.evaluate((ms) => window.rotar.en(ms), ms)
      await foto(`cambio-${i}-${k}.png`, PASO)
    }
  }
  writeFileSync(
    join(cuadros, 'cuadros.json'),
    JSON.stringify({ zona: { x: zona.x - recorte.x, y: zona.y - recorte.y }, cuadros: lista }),
  )
  await page.close()

  execFileSync('python', [join(REPO, 'scripts', 'portada-gif.py'), cuadros, join(SALIDA, 'portada.gif')], {
    stdio: 'inherit',
  })
  rmSync(cuadros, { recursive: true, force: true })
}

const logotipoSvg = await piezasDelSitio()
const medidas = await piezasLocales(logotipoSvg)
await portada()
await browser.close()

console.log('Medidas en px de CSS (los PNG van al doble):')
for (const [pieza, medida] of Object.entries(medidas)) console.log(`  ${pieza}: ${medida}`)
