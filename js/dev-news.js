
const NEWS_API = "https://hn.algolia.com/api/v1/search";

const NEWS_QUERIES = [
  "programming",
  "programación",
  "JavaScript",
  "Python"
];

const NEWS_LIMIT = 5;
const CACHE_KEY = "dev-news-cache-v1";
const CACHE_TIME = 10 * 60 * 1000;

const list = document.querySelector("#dev-news-list");

function getCachedNews() {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);

    if (!cached) return null;

    const data = JSON.parse(cached);

    if (Date.now() - data.timestamp > CACHE_TIME) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data.articles;
  } catch {
    return null;
  }
}

function saveCachedNews(articles) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        articles
      })
    );
  } catch {
    // Si el almacenamiento no está disponible,
    // la sección seguirá funcionando.
  }
}

async function fetchNews() {
  const cached = getCachedNews();

  if (cached) return cached;

  const results = await Promise.all(
    NEWS_QUERIES.map(async (query) => {
      const params = new URLSearchParams({
        query,
        tags: "story",
        hitsPerPage: "10"
      });

      const response = await fetch(
        `${NEWS_API}?${params}`
      );

      if (!response.ok) {
        throw new Error("No se pudieron cargar las noticias");
      }

      const data = await response.json();
      return data.hits || [];
    })
  );

  const uniqueArticles = new Map();

  for (const article of results.flat()) {
    if (!article.title) continue;

    // Ignora coincidencias antiguas o sin enlace.
    if (!article.created_at_i) continue;

    const url =
      article.url ||
      `https://news.ycombinator.com/item?id=${article.objectID}`;

    // Solo permitimos enlaces HTTP y HTTPS.
    try {
      const parsedUrl = new URL(url);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        continue;
      }
    } catch {
      continue;
    }

    uniqueArticles.set(article.objectID, {
      id: article.objectID,
      title: article.title,
      url,
      points: Number(article.points) || 0,
      date: article.created_at_i
    });
  }

  const articles = [...uniqueArticles.values()]
    .sort((a, b) => b.date - a.date)
    .slice(0, NEWS_LIMIT);

  saveCachedNews(articles);

  return articles;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short"
  }).format(new Date(timestamp * 1000));
}

function renderNews(articles) {
  list.replaceChildren();

  if (!articles.length) {
    showMessage("No hay noticias disponibles.");
    return;
  }

  for (const article of articles) {
    const item = document.createElement("article");
    item.className = "dev-news__item";

    const link = document.createElement("a");
    link.className = "dev-news__link";
    link.href = article.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = article.title;

    const meta = document.createElement("div");
    meta.className = "dev-news__meta";

    const date = document.createElement("span");
    date.textContent = formatDate(article.date);

    const points = document.createElement("span");
    points.textContent = `${article.points} puntos`;

    meta.append(date, points);
    item.append(link, meta);
    list.append(item);
  }
}

function showMessage(message) {
  const paragraph = document.createElement("p");
  paragraph.className = "dev-news__status";
  paragraph.textContent = message;
  list.replaceChildren(paragraph);
}

async function initNews() {
  try {
    const articles = await fetchNews();
    renderNews(articles);
  } catch (error) {
    console.error("Error cargando noticias:", error);
    showMessage(
      "No se pudieron cargar las noticias. Inténtalo más tarde."
    );
  } finally {
    list.setAttribute("aria-busy", "false");
  }
}

initNews();
