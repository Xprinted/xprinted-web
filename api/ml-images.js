export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  
  const SELLER_ID = '1954423536';
  
  try {
    const results = {};
    
    // Fetch pages of results from public search endpoint (no auth needed)
    for (let offset = 0; offset < 150; offset += 50) {
      const url = `https://api.mercadolibre.com/sites/MLA/search?seller_id=${SELLER_ID}&limit=50&offset=${offset}`;
      const resp = await fetch(url);
      if (!resp.ok) break;
      const data = await resp.json();
      
      if (!data.results || data.results.length === 0) break;
      
      data.results.forEach(item => {
        results[item.id] = {
          id: item.id,
          thumbnail: item.thumbnail 
            ? item.thumbnail.replace('http://', 'https://').replace(/-I\.jpg/, '-O.jpg').replace(/-I\.webp/, '-O.jpg')
            : null,
          permalink: item.permalink
        };
      });
      
      if (data.results.length < 50) break;
    }
    
    res.status(200).json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
