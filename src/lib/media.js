// Fotos: o próprio celular reduz e comprime antes de enviar
// (cada foto fica com uns 200 a 400 KB e cabe bastante no 1 GB grátis)

const MAX_SIDE = 1440;
const QUALITY = 0.82;

function canvasToBlob(canvas, type = 'image/jpeg', quality = QUALITY) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao preparar a foto.'))), type, quality);
    } else {
      const data = canvas.toDataURL(type, quality);
      const bin = atob(data.split(',')[1]);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      resolve(new Blob([arr], { type }));
    }
  });
}

async function decode(url) {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch {
    await new Promise((res, rej) => {
      if (img.complete && img.naturalWidth) return res();
      img.onload = res;
      img.onerror = () => rej(new Error('Não consegui abrir essa imagem. Tente uma foto JPG ou PNG.'));
    });
  }
  if (!img.naturalWidth) throw new Error('Não consegui abrir essa imagem. Tente uma foto JPG ou PNG.');
  return img;
}

// Arquivo escolhido → { blob, width, height, preview }
export async function preparePhoto(file) {
  if (file.type && !file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  const srcUrl = URL.createObjectURL(file);
  try {
    const img = await decode(srcUrl);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await canvasToBlob(canvas);
    // Safari guarda a memória do canvas se não zerarmos
    canvas.width = 1;
    canvas.height = 1;
    return { blob, width, height, preview: URL.createObjectURL(blob) };
  } finally {
    URL.revokeObjectURL(srcUrl);
  }
}
