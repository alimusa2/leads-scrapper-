require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Config ───────────────────────────────────────────────────────────────────
// Token is read from backend/.env (APIFY_API_TOKEN). Never hard-code or log it.
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const APIFY_GMB_TOKEN = process.env.APIFY_GMB_API_TOKEN || process.env.APIFY_API_TOKEN;

// Exact Actor IDs specified by user and verified on Apify Store
const ACTORS = {
  linkedin: 'automly~linkedin-people-search-scraper',
  reddit: 'trudax~reddit-scraper-lite',
  gmb: 'compass~crawler-google-places',
};

const APIFY_BASE = 'https://api.apify.com/v2';
const POLL_INTERVAL_MS = 4000;
const MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Error whose message is safe to show to the end user. */
class UserError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

/** Accepts an array or a comma/newline separated string → clean string[] */
function toList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(/[\n,]+/).map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

function clampNumber(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

const orNull = (v) => (v === undefined || v === null || v === '' ? null : v);

const authHeader = (customToken) => ({ Authorization: `Bearer ${customToken || APIFY_TOKEN}` });

/** Translate Apify / network errors into short user-facing messages. */
function toUserError(err) {
  if (err instanceof UserError) return err;

  const status = err.response?.status;
  const apifyMsg = err.response?.data?.error?.message;
  console.error('[Apify] Request failed:', status || err.code || '', apifyMsg || err.message);

  if (status === 401 || status === 403) {
    return new UserError('Apify authentication failed. Check API tokens.', 502);
  }
  if (status === 402) {
    return new UserError('Apify account has insufficient credit for this run.', 502);
  }
  if (status === 404) {
    return new UserError('Apify Actor not found. Check the Actor ID.', 502);
  }
  if (status === 400) {
    return new UserError('Apify rejected the Actor input. Check the search fields.', 502);
  }
  if (status === 429) {
    return new UserError('Apify rate limit reached. Please try again in a minute.', 502);
  }
  if (!status) {
    return new UserError('Could not reach Apify. Check your internet connection.', 502);
  }
  return new UserError('Apify request failed. Please try again.', 502);
}

/** Start an Actor run, poll until it finishes, then return its dataset items. */
async function runActorAndWait(actorId, input, maxItems, customToken = null) {
  console.log(`[Apify] Starting ${actorId}`);
  console.log('[Apify] Input:', JSON.stringify(input));

  const runRes = await axios.post(`${APIFY_BASE}/acts/${actorId}/runs`, input, {
    headers: { ...authHeader(customToken), 'Content-Type': 'application/json' },
  });

  const runId = runRes.data.data.id;
  console.log(`[Apify] Run started: ${runId}`);

  const startTime = Date.now();
  while (Date.now() - startTime < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const statusRes = await axios.get(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: authHeader(customToken),
    });
    const { status, defaultDatasetId, statusMessage } = statusRes.data.data;
    console.log(`[Apify] ${runId} status: ${status}`);

    if (status === 'SUCCEEDED') {
      const dataRes = await axios.get(`${APIFY_BASE}/datasets/${defaultDatasetId}/items`, {
        headers: authHeader(customToken),
        params: { clean: true, limit: maxItems },
      });
      return { runId, items: Array.isArray(dataRes.data) ? dataRes.data : [] };
    }

    if (status === 'TIMED-OUT') {
      throw new UserError('Search timed out.', 504);
    }
    if (status === 'FAILED' || status === 'ABORTED') {
      console.error(`[Apify] Run ${runId} ${status}: ${statusMessage || ''}`);
      throw new UserError(`Apify Actor failed: ${statusMessage || status}`, 502);
    }
  }

  axios
    .post(`${APIFY_BASE}/actor-runs/${runId}/abort`, null, { headers: authHeader(customToken) })
    .catch(() => {});
  throw new UserError('Search timed out.', 504);
}

// ─── LinkedIn ─────────────────────────────────────────────────────────────────

function buildLinkedInInput(body) {
  const searchQuery = String(body.search || '').trim();
  const locations = toList(body.location);
  const jobTitles = toList(body.jobTitles);
  const maxResults = clampNumber(body.limit, 1, 100, 20);

  if (!searchQuery && jobTitles.length === 0) {
    throw new UserError('Enter a Search / Industry or at least one Job Title.', 400);
  }

  // Live schema of automly/linkedin-people-search-scraper:
  // searchQuery (string), jobTitles (array), locations (array), maxResults (integer)
  const input = { maxResults };
  if (jobTitles.length) input.jobTitles = jobTitles;
  if (locations.length) input.locations = locations;
  if (searchQuery) input.searchQuery = searchQuery;

  return { input, maxResults, searchQuery };
}

/** "Procurement Manager for Epiroc - Surface..." → { title, company } */
function splitHeadline(headline) {
  if (!headline) return { title: null, company: null };
  const h = String(headline).trim();

  // Pattern 1: explicit separators like " at ", " @ ", " for "
  let match = h.match(/^(.*?)\s+(?:at|@|for)\s+(.+)$/i);
  if (match) {
    const title = match[1].trim();
    const compParts = match[2].split(/\s+[|\-•]\s+/);
    const company = compParts[0].trim();
    return { title: title || null, company: company || null };
  }

  // Pattern 2: pipe, dash or bullet separator "Title | Company" or "Title - Company"
  match = h.match(/^(.*?)\s+[|\-•]\s+(.+)$/);
  if (match) {
    const title = match[1].trim();
    const compParts = match[2].split(/\s+[|\-•]\s+/);
    const company = compParts[0].trim();
    return { title: title || null, company: company || null };
  }

  // Pattern 3: comma separator "Title, Company"
  match = h.match(/^(.*?),\s+(.+)$/);
  if (match) {
    const title = match[1].trim();
    const company = match[2].split(/\s+[|\-•]\s+/)[0].trim();
    return { title: title || null, company: company || null };
  }

  return { title: h, company: null };
}

function normalizeLinkedIn(item, searchQuery) {
  const fromHeadline = splitHeadline(item.headline);
  const rawUrl = item.linkedinUrl || item.url || item.profileUrl;
  let profileUrl = orNull(rawUrl);
  if (profileUrl && !profileUrl.startsWith('http')) {
    profileUrl = `https://www.linkedin.com${profileUrl.startsWith('/') ? '' : '/'}${profileUrl}`;
  }

  const jobTitle = orNull(
    item.jobTitle || (Array.isArray(item.jobTitles) && item.jobTitles[0]) || fromHeadline.title
  );
  const company = orNull(item.company || item.currentCompany || fromHeadline.company);

  return {
    platform: 'LinkedIn',
    name: orNull(item.name || item.fullName),
    jobTitle,
    company,
    location: orNull(item.location),
    profileUrl,
    headline: orNull(item.headline),
    sourceUrl: profileUrl,
    searchTerm: orNull(item.query || searchQuery),
  };
}

// ─── Reddit ───────────────────────────────────────────────────────────────────

function buildRedditInput(body) {
  const searchTerms = toList(body.searchTerms);
  const subreddits = toList(body.subreddits)
    .map((s) => s.replace(/^\/?r\//i, '').replace(/[^A-Za-z0-9_]/g, ''))
    .filter(Boolean);
  const maxItems = clampNumber(body.limit, 1, 100, 20);

  if (searchTerms.length === 0) {
    throw new UserError('Enter at least one search term.', 400);
  }

  // Fast mode without high-resource browser proxy overhead (prevents 'Not enough funds' error)
  const input = {
    searches: searchTerms,
    searchPosts: true,
    maxItems,
    skipComments: true,
    skipCommunity: true,
    skipUserPosts: true,
  };

  if (subreddits.length > 0) {
    input.searchCommunityName = subreddits[0];
  }

  return { input, maxItems, searchTerms };
}

function matchSearchTerm(item, searchTerms) {
  const haystack = `${item.title || ''} ${item.body || ''} ${item.text || ''}`.toLowerCase();
  const exact = searchTerms.find((t) => haystack.includes(t.toLowerCase()));
  if (exact) return exact;
  let best = null;
  let bestScore = 0;
  for (const term of searchTerms) {
    const words = term.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const score = words.filter((w) => haystack.includes(w)).length;
    if (score > bestScore) {
      best = term;
      bestScore = score;
    }
  }
  return best || (searchTerms.length === 1 ? searchTerms[0] : null);
}

function normalizeReddit(item, searchTerms) {
  const subreddit =
    item.parsedCommunityName ||
    (item.communityName ? String(item.communityName).replace(/^r\//i, '') : null) ||
    item.category;

  let rawUrl = item.url || item.permalink || item.link;
  if (!rawUrl && subreddit && (item.parsedId || item.id)) {
    const cleanId = String(item.parsedId || item.id).replace(/^t\d_/, '');
    rawUrl = `https://www.reddit.com/r/${subreddit}/comments/${cleanId}`;
  } else if (rawUrl && rawUrl.startsWith('/')) {
    rawUrl = `https://www.reddit.com${rawUrl}`;
  }

  const name = orNull(item.username || item.author);
  const cleanName = name === '[deleted]' || name === '[removed]' ? null : name;
  const title = orNull(item.title);
  const text = orNull(item.body || item.text);

  return {
    platform: 'Reddit',
    name: cleanName,
    title: title === '[deleted]' || title === '[removed]' ? null : title,
    text: text === '[deleted]' || text === '[removed]' ? null : text,
    subreddit: orNull(subreddit),
    sourceUrl: orNull(rawUrl),
    searchTerm: matchSearchTerm(item, searchTerms),
    type: orNull(item.dataType || 'post'),
    createdAt: orNull(item.createdAt),
    upVotes: typeof item.upVotes === 'number' ? item.upVotes : typeof item.score === 'number' ? item.score : null,
    commentCount: typeof item.numberOfComments === 'number' ? item.numberOfComments : typeof item.numComments === 'number' ? item.numComments : null,
  };
}

// ─── GMB (Google Maps) ─────────────────────────────────────────────────────────

function buildGMBInput(body) {
  const searchQuery = String(body.search || body.searchTerm || '').trim();
  const locationQuery = String(body.location || '').trim();
  const maxItems = clampNumber(body.limit, 1, 100, 20);

  if (!searchQuery) {
    throw new UserError('Enter a search term (e.g. plumbers, restaurants, dentists).', 400);
  }

  const query = locationQuery ? `${searchQuery} in ${locationQuery}` : searchQuery;

  const input = {
    searchStringsArray: [query],
    maxCrawledPlacesPerSearch: maxItems,
    language: 'en',
  };

  return { input, maxItems, searchQuery, locationQuery };
}

function normalizeGMB(item, searchQuery, locationQuery) {
  const name = orNull(item.title || item.name);
  const category = orNull(item.categoryName || item.category || item.type);
  const address = orNull(item.address);
  const city = orNull(item.city);
  const state = orNull(item.state);
  const phone = orNull(item.phone);
  const website = orNull(item.website);
  const sourceUrl = orNull(item.url || item.googleMapsUrl);
  const rating = typeof item.totalScore === 'number' ? item.totalScore : (typeof item.stars === 'number' ? item.stars : null);
  const reviewsCount = typeof item.reviewsCount === 'number' ? item.reviewsCount : (typeof item.reviews === 'number' ? item.reviews : null);

  return {
    platform: 'GMB',
    name,
    title: name,
    category,
    address,
    city,
    state,
    location: locationQuery || orNull(city ? `${city}${state ? ', ' + state : ''}` : address),
    phone,
    website,
    hasWebsite: Boolean(website),
    sourceUrl,
    rating,
    reviewsCount,
    searchTerm: searchQuery,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', tokenConfigured: Boolean(APIFY_TOKEN) });
});

// Cache to support pagination without fetching from Apify every time
// Structure: { cacheKey: { leads: [], currentIndex: 0, runId: '' } }
const searchCache = {};

// POST /api/leads/search
// LinkedIn body: { platform: 'linkedin', search, location, jobTitles, limit }
// Reddit body:   { platform: 'reddit', searchTerms, subreddits?, limit }
// GMB body:      { platform: 'gmb', search, location, limit, websiteFilter }
app.post('/api/leads/search', async (req, res) => {
  try {
    if (!APIFY_TOKEN) {
      throw new UserError('APIFY_API_TOKEN is not set on the server. Add it to backend/.env.', 500);
    }

    const platform = String(req.body.platform || '').toLowerCase();
    const limit = clampNumber(req.body.limit, 1, 100, 20);
    const websiteFilter = String(req.body.websiteFilter || 'all');
    
    // Create cache key ignoring limit and websiteFilter (since we filter from cache)
    const cacheKey = `${platform}|${String(req.body.search || req.body.searchTerms || '').trim()}|${String(req.body.location || req.body.subreddits || '').trim()}`.toLowerCase();

    // Helper to filter leads based on UI filters
    const applyFilters = (leadsList) => {
      if (platform !== 'gmb') return leadsList;
      return leadsList.filter(lead => {
        if (websiteFilter === 'with_website') return lead.hasWebsite;
        if (websiteFilter === 'without_website') return !lead.hasWebsite;
        return true; // 'all'
      });
    };

    if (searchCache[cacheKey] && searchCache[cacheKey].currentIndex < searchCache[cacheKey].leads.length) {
      const cache = searchCache[cacheKey];
      const remainingFiltered = applyFilters(cache.leads.slice(cache.currentIndex));
      
      if (remainingFiltered.length > 0) {
        const chunk = remainingFiltered.slice(0, limit);
        const lastItem = chunk[chunk.length - 1];
        const lastItemIndex = cache.leads.indexOf(lastItem, cache.currentIndex);
        cache.currentIndex = lastItemIndex + 1;
        
        console.log(`[Cache] Returning ${chunk.length} leads for ${cacheKey}`);
        return res.json({ success: true, count: chunk.length, runId: cache.runId, leads: chunk });
      }
    }

    let leads;
    let runId;
    const batchSize = Math.max(limit * 3, 50); // Fetch a larger batch for caching

    if (platform === 'linkedin') {
      const { input, maxResults, searchQuery } = buildLinkedInInput(req.body);
      input.maxResults = batchSize;
      const result = await runActorAndWait(ACTORS.linkedin, input, batchSize);
      runId = result.runId;
      leads = result.items
        .map((item) => normalizeLinkedIn(item, searchQuery))
        .filter((lead) => lead && (lead.name || lead.headline || lead.profileUrl));
    } else if (platform === 'reddit') {
      const { input, maxItems, searchTerms } = buildRedditInput(req.body);
      input.maxItems = batchSize;
      const result = await runActorAndWait(ACTORS.reddit, input, batchSize);
      runId = result.runId;
      leads = result.items
        .map((item) => normalizeReddit(item, searchTerms))
        .filter((lead) => lead && (lead.title || lead.text) && lead.sourceUrl);
    } else if (platform === 'gmb') {
      const { input, maxItems, searchQuery, locationQuery } = buildGMBInput(req.body);
      input.maxCrawledPlacesPerSearch = batchSize;
      const result = await runActorAndWait(ACTORS.gmb, input, batchSize, APIFY_GMB_TOKEN);
      runId = result.runId;
      leads = result.items
        .map((item) => normalizeGMB(item, searchQuery, locationQuery))
        .filter((lead) => lead && (lead.name || lead.phone || lead.website || lead.sourceUrl));
    } else {
      throw new UserError('Choose a platform: linkedin, reddit, or gmb.', 400);
    }

    // Initialize cache
    searchCache[cacheKey] = { leads, currentIndex: 0, runId };

    const filtered = applyFilters(leads);
    const chunk = filtered.slice(0, limit);
    
    if (chunk.length > 0) {
      const lastItem = chunk[chunk.length - 1];
      searchCache[cacheKey].currentIndex = leads.indexOf(lastItem) + 1;
    } else {
      searchCache[cacheKey].currentIndex = leads.length; // Exhausted
    }

    console.log(`[Leads] ${platform}: fetched ${leads.length}, returning ${chunk.length} leads (run ${runId})`);

    if (chunk.length === 0) {
      return res.json({ success: true, count: 0, runId, leads: [], message: 'No leads found for this search.' });
    }
    res.json({ success: true, count: chunk.length, runId, leads: chunk });
  } catch (err) {
    const userErr = toUserError(err);
    res.status(userErr.status || 500).json({ success: false, error: userErr.message });
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n🚀 LeadHarvest API running at http://localhost:${PORT}`);
    console.log(`   LinkedIn actor: ${ACTORS.linkedin}`);
    console.log(`   Reddit actor:   ${ACTORS.reddit}`);
    console.log(`   GMB actor:      ${ACTORS.gmb}`);
    console.log(`   Apify token:    ${APIFY_TOKEN ? 'configured' : 'MISSING (set APIFY_API_TOKEN in backend/.env)'}`);
    console.log(`   Apify GMB token:${APIFY_GMB_TOKEN ? 'configured' : 'MISSING (set APIFY_GMB_API_TOKEN in backend/.env)'}\n`);
  });
}

module.exports = app;
