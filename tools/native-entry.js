// Puente con el celu (Capacitor). En la compu usa el dictado de Chrome si está disponible.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

const esNativo = Capacitor.isNativePlatform();
const WebSR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

window.NATIVO = {
  esNativo,
  puedeVoz: esNativo || !!WebSR,
  async voz() {
    if (esNativo) {
      const p = await SpeechRecognition.requestPermissions();
      if (p.speechRecognition !== 'granted') throw new Error('permiso');
      const a = await SpeechRecognition.available();
      if (!a.available) throw new Error('no-disponible');
      const r = await SpeechRecognition.start({ language: 'es-AR', maxResults: 1, prompt: 'Decí el movimiento', partialResults: false, popup: true });
      return (r && r.matches && r.matches[0]) || '';
    }
    if (!WebSR) throw new Error('no-disponible');
    return new Promise((ok, ko) => {
      const rec = new WebSR(); rec.lang = 'es-AR'; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = e => ok(e.results[0][0].transcript || '');
      rec.onerror = e => ko(new Error(e.error || 'error'));
      rec.onnomatch = () => ok('');
      rec.start();
    });
  },
  onLink(cb) {
    if (!esNativo) return;
    App.addListener('appUrlOpen', e => cb(e.url));
    App.getLaunchUrl().then(r => { if (r && r.url) cb(r.url); }).catch(() => {});
  }
};
