const axios = require('axios');

// Reverse geocoding: coordenadas -> cidade/UF/país.
// Nunca lança — falha de geocoding não pode bloquear uma assinatura.
async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return null;

  try {
    const { data } = await axios.get(
      'https://api.bigdatacloud.net/data/reverse-geocode-client',
      {
        params: { latitude: lat, longitude: lng, localityLanguage: 'pt' },
        timeout: 5000,
      }
    );
    const cidade = data.city || data.locality || null;
    if (cidade) {
      return {
        cidade,
        uf: (data.principalSubdivisionCode || '').split('-')[1] || data.principalSubdivision || null,
        pais: data.countryName || null,
      };
    }
  } catch (err) {
    console.error('[Geocoding] BigDataCloud falhou:', err.message);
  }

  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { format: 'json', lat, lon: lng, 'accept-language': 'pt-BR' },
      headers: { 'User-Agent': 'ServicoSeguro-ContratoBlindado/1.0' },
      timeout: 5000,
    });
    const addr = data.address || {};
    const cidade = addr.city || addr.town || addr.village || addr.municipality || null;
    if (cidade) {
      return { cidade, uf: addr.state || null, pais: addr.country || null };
    }
  } catch (err) {
    console.error('[Geocoding] Nominatim falhou:', err.message);
  }

  return null;
}

module.exports = { reverseGeocode };
