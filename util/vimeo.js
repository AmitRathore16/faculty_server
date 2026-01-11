import { Vimeo } from "vimeo";

const VIMEO_EMBED_BASE = "https://player.vimeo.com/video";

const requireVimeoEnv = () => {
  const { VIMEO_CLIENT_ID, VIMEO_CLIENT_SECRET, VIMEO_ACCESS_TOKEN } =
    process.env;

  if (!VIMEO_CLIENT_ID || !VIMEO_CLIENT_SECRET || !VIMEO_ACCESS_TOKEN) {
    throw new Error(
      "Missing Vimeo credentials. Please set VIMEO_CLIENT_ID, VIMEO_CLIENT_SECRET, and VIMEO_ACCESS_TOKEN"
    );
  }

  return { VIMEO_CLIENT_ID, VIMEO_CLIENT_SECRET, VIMEO_ACCESS_TOKEN };
};

const createClient = () => {
  const { VIMEO_CLIENT_ID, VIMEO_CLIENT_SECRET, VIMEO_ACCESS_TOKEN } =
    requireVimeoEnv();
  return new Vimeo(VIMEO_CLIENT_ID, VIMEO_CLIENT_SECRET, VIMEO_ACCESS_TOKEN);
};

const extractVimeoId = (uriOrLink = "") => {
  const normalized = uriOrLink.trim();
  const idMatch = normalized.match(/(?:\/videos\/|video\/|vimeo\.com\/)(\d+)/i);
  return idMatch ? idMatch[1] : null;
};

const buildEmbedUrl = ({ uri, link } = {}) => {
  const id = extractVimeoId(uri || link);
  return id ? `${VIMEO_EMBED_BASE}/${id}` : null;
};

const requestFields = (client, uri, fields) =>
  new Promise((resolve, reject) => {
    client.request(`${uri}?fields=${fields}`, (error, body) => {
      if (error) {
        return reject(error);
      }
      resolve(body || {});
    });
  });

export const uploadVideoToVimeo = (filePath, { name, description } = {}) => {
  const client = createClient();

  return new Promise((resolve, reject) => {
    client.upload(
      filePath,
      { name, description },
      (uri) => resolve({ uri }),
      () => {},
      (error) => reject(error)
    );
  });
};

export const getVimeoStatus = async (uri) => {
  if (!uri) {
    throw new Error("Missing Vimeo URI for status lookup");
  }

  const client = createClient();
  const body = await requestFields(
    client,
    uri,
    "link,player_embed_url,transcode.status"
  );

  const embedUrl =
    body.player_embed_url || buildEmbedUrl({ uri, link: body.link });
  const status = body?.transcode?.status || "unknown";

  return {
    uri,
    status,
    link: body.link || null,
    embedUrl,
  };
};

export const uploadVideoAndResolve = async (filePath, meta = {}) => {
  const { uri } = await uploadVideoToVimeo(filePath, meta);
  const status = await getVimeoStatus(uri);
  return { uri, ...status };
};

export const isVimeoEmbedUrl = (value = "") =>
  /^https?:\/\/player\.vimeo\.com\/video\/\d+(?:[/?#].*)?$/i.test(value.trim());

export const ensureVimeoEmbedUrl = (value = "") => {
  if (!isVimeoEmbedUrl(value)) {
    throw new Error(
      "Intro video must be a Vimeo embed URL (https://player.vimeo.com/video/{id})"
    );
  }
  return value;
};

export const deriveEmbedFromUriOrLink = (uri, link) =>
  buildEmbedUrl({ uri, link });
