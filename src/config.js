// =====================================================================
//  Configuração do FargusThreads
//
//  1. Supabase do FargusThreads (o projeto NOVO, só para o Threads):
//     cole a URL e a chave pública. No painel do Supabase: botão "Connect",
//     ou Project Settings → Data API (URL) e Project Settings → API Keys.
//
//  2. Supabase do FargusGram: já vem preenchido. É de lá que vêm o login,
//     os jogadores e os personagens.
//
//  Estes valores são públicos por natureza (vão para o navegador de todo
//  mundo). Quem protege os dados são as regras do supabase/setup.sql.
//  Nunca coloque aqui a chave "secret" ou "service_role".
// =====================================================================

const env = import.meta.env ?? {};

// --- 1. Supabase do FargusThreads ---------------------------------------
export const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://gfronkeofwnpdmnqbjwz.supabase.co';

export const SUPABASE_KEY = env.VITE_SUPABASE_KEY || 'sb_publishable_3SPXR8g2pLEbycTysLVZWQ_A1Cbxzxz';

// --- 2. Supabase do FargusGram ------------------------------------------
export const GRAM_URL = env.VITE_GRAM_URL || 'https://vhiagccrtqxizserfdzm.supabase.co';

export const GRAM_KEY = env.VITE_GRAM_KEY || 'sb_publishable_YvM0xKvUvhg3zlMzLyNpZw_i8jiyizN';

// Endereço do FargusGram no ar (para os botões "Abrir no FargusGram")
export const GRAM_SITE = env.VITE_GRAM_SITE || 'https://enricodigioia.github.io/FargusGram/';

// Nome que aparece no app
export const APP_NAME = 'FargusThreads';
