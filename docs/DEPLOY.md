# Como colocar o FargusThreads no ar

Este guia leva o FargusThreads do zero até o primeiro acesso, e depois explica como atualizar o app, mexer no banco e resolver os problemas mais comuns. Leva uns 20 minutos, uma vez só.

## Sumário

- [Valores deste projeto](#valores-deste-projeto)
- [Antes de começar](#antes-de-começar)
- [1. Criar o projeto no Supabase](#1-criar-o-projeto-no-supabase)
- [2. Criar o banco de dados](#2-criar-o-banco-de-dados)
- [3. Criar a função de login](#3-criar-a-função-de-login)
- [4. Fechar o cadastro direto](#4-fechar-o-cadastro-direto)
- [5. Ligar o app ao Supabase](#5-ligar-o-app-ao-supabase)
- [6. Publicar no GitHub Pages](#6-publicar-no-github-pages)
- [7. Primeiro acesso](#7-primeiro-acesso)
- [8. Instalar no celular](#8-instalar-no-celular)
- [Checklist](#checklist)
- [Atualizar o app](#atualizar-o-app)
- [Atualizar o banco](#atualizar-o-banco)
- [Manter no ar](#manter-no-ar)
- [Problemas comuns](#problemas-comuns)

## Valores deste projeto

| O quê | Valor |
| --- | --- |
| Site | https://enricodigioia.github.io/FargusThreads/ |
| Repositório | https://github.com/EnricoDiGioia/FargusThreads |
| Pasta no computador | `D:\GithubProjects\FargusThreads` |
| Supabase do FargusThreads | projeto `fargusthreads`, URL `https://gfronkeofwnpdmnqbjwz.supabase.co` |
| Supabase do FargusGram | URL `https://vhiagccrtqxizserfdzm.supabase.co` |
| Função de login | `fargusgram`, no Supabase do FargusThreads |
| Bucket de fotos | `midia` (público), no Supabase do FargusThreads |

As chaves públicas (`sb_publishable_…`) dos dois Supabase estão em `src/config.js`. A chave `secret` não fica em lugar nenhum do projeto: a função recebe a dela do próprio Supabase.

## Antes de começar

- O FargusGram precisa estar no ar, porque o login e os personagens vêm dele.
- Use a mesma conta do Supabase do FargusGram. O plano grátis permite 2 projetos ativos por conta, e os dois apps ocupam essas duas vagas.
- O repositório no GitHub precisa ser **público**, porque o GitHub Pages grátis só funciona assim.

## 1. Criar o projeto no Supabase

1. Entre em [supabase.com](https://supabase.com) e clique em **New project**.
2. Use o nome `fargusthreads`, crie uma senha para o banco (guarde, mas o app não usa) e escolha a região **South America (São Paulo)**.
3. Espere um ou dois minutos até o projeto ficar pronto.

## 2. Criar o banco de dados

1. No projeto **fargusthreads**, abra **SQL Editor** e clique em **New query**.
2. Abra o arquivo [`supabase/setup.sql`](../supabase/setup.sql), copie tudo, cole no editor e clique em **Run**.
3. No fim deve aparecer `FargusThreads: banco configurado com sucesso ✔`.

O Supabase pode avisar que o script tem comandos "destrutivos". Pode confirmar: ele só apaga e recria as próprias regras de segurança, nunca os dados. O script pode ser rodado de novo sempre que quiser.

## 3. Criar a função de login

1. Ainda no **fargusthreads**, abra **Edge Functions** e clique em **Deploy a new function** → **Via Editor**.
2. Apague o código de exemplo e cole todo o arquivo [`supabase/functions/fargusgram/index.ts`](../supabase/functions/fargusgram/index.ts). O jeito mais fácil de copiar é abrir a [versão crua do arquivo](https://raw.githubusercontent.com/EnricoDiGioia/FargusThreads/main/supabase/functions/fargusgram/index.ts), apertar Ctrl+A e Ctrl+C.
3. No campo do nome, escreva `fargusgram`, exatamente assim, e clique em **Deploy function**.
4. Na página da função, abra **Details** e desligue **Verify JWT with legacy secret** (em painéis mais antigos aparece como **Enforce JWT Verification**). Salve.

O passo 4 é necessário porque quem chama a função ainda não tem login no FargusThreads; a própria função confere o login do FargusGram. Ela não precisa de nenhuma configuração extra: o endereço e a chave pública do FargusGram já estão no começo do arquivo, e as chaves do Supabase do FargusThreads o próprio Supabase entrega para ela.

## 4. Fechar o cadastro direto

Ninguém precisa se cadastrar no Supabase do FargusThreads, porque os logins são criados pela função.

1. Abra **Authentication** → **Sign In / Providers**.
2. Desligue **Allow new users to sign up** e salve. Deixe o provedor **Email** ligado, porque a função usa.

Mesmo sem esse passo, quem se cadastrasse por fora não veria nada, porque as regras do banco só liberam jogadores do FargusGram. Ele só deixa tudo mais fechado.

## 5. Ligar o app ao Supabase

1. No projeto **fargusthreads**, clique em **Connect** no topo. A URL também fica em **Project Settings** → **Data API** e a chave em **Project Settings** → **API Keys**.
2. Copie a **Project URL** e a **publishable key** (começa com `sb_publishable_`).
3. Abra `src/config.js` e cole os dois valores na parte **1. Supabase do FargusThreads**. A parte do FargusGram já vem preenchida.

Dá para fazer isso direto no site do GitHub: abra o arquivo, clique no lápis, cole os valores e confirme o commit. Nunca coloque no app a chave `secret` ou `service_role`.

## 6. Publicar no GitHub Pages

1. No repositório, abra **Settings** → **Pages** e, em **Build and deployment** → **Source**, escolha **GitHub Actions**.
2. Abra a aba **Actions** e espere o "Publicar no GitHub Pages" ficar verde. Se alguma execução tiver falhado por ter rodado antes do passo 1, abra a execução e clique em **Re-run all jobs**.
3. O site fica em https://enricodigioia.github.io/FargusThreads/.

A partir daí, todo push na branch `main` publica o site de novo sozinho.

## 7. Primeiro acesso

1. Abra o site. No computador com o FargusGram aberto no mesmo navegador, aparece **Continuar com o FargusGram**; no celular, entre com o e-mail e a senha do FargusGram.
2. Na primeira vez aparecem os seus personagens e a opção **Seguir as mesmas contas**: cada personagem passa a seguir aqui quem já segue no FargusGram, sem avisar ninguém.
3. Mande o link no grupo. Cada um entra com a própria conta do FargusGram.

## 8. Instalar no celular

**iPhone:** abra o link no **Safari**, toque em **Compartilhar** e depois em **Adicionar à Tela de Início**. Se o link abrir dentro do WhatsApp ou do Instagram, copie e cole no Safari.

**Android:** abra o link no **Chrome**, toque no menu ⋮ e depois em **Instalar app**.

O próprio app mostra essas instruções na tela inicial para quem ainda não instalou.

## Checklist

- [ ] Projeto `fargusthreads` criado no Supabase
- [ ] `supabase/setup.sql` rodado, com a mensagem ✔ no fim
- [ ] Função `fargusgram` publicada, com **Verify JWT** desligado
- [ ] Cadastro direto (**Allow new users to sign up**) desligado
- [ ] URL e publishable key coladas em `src/config.js`
- [ ] GitHub Pages com a fonte **GitHub Actions** e o workflow verde
- [ ] Primeiro login feito e link mandado no grupo

## Atualizar o app

O código fica em `D:\GithubProjects\FargusThreads`. Para mexer e publicar pelo computador, use o PowerShell, com [Git](https://git-scm.com) e [Node.js](https://nodejs.org) 22 ou mais novo.

### Ligar a pasta ao GitHub (uma vez só)

Se a pasta não tiver a pasta oculta `.git` (por exemplo, porque foi copiada sem o Git), ligue-a ao repositório:

```powershell
cd D:\GithubProjects\FargusThreads
git init -b main
git remote add origin https://github.com/EnricoDiGioia/FargusThreads.git
git fetch origin
git reset --hard origin/main
git branch -u origin/main
```

O `reset --hard` deixa a pasta igual ao GitHub: traz o que faltar (como a pasta `.github`) e desfaz qualquer mudança local, então rode antes de começar a mexer. Num computador novo é mais simples clonar, dentro de `D:\GithubProjects`: `git clone https://github.com/EnricoDiGioia/FargusThreads.git`.

### Mexer e publicar

```powershell
cd D:\GithubProjects\FargusThreads
git pull                # pega o que mudou no GitHub
npm install             # só na primeira vez ou quando o package.json mudar
npm run dev             # abre o app em http://localhost:5173
```

Depois de testar:

```powershell
git add -A
git commit -m "O que mudou"
git push
```

Em poucos minutos o site é atualizado, e quem estiver com o app aberto vê o aviso "Nova versão do FargusThreads disponível".

> [!WARNING]
> O `npm run dev` usa o mesmo Supabase do site publicado, então o que você publicar testando aparece para o grupo. Para testar à parte, crie outro projeto no Supabase, rode o `setup.sql` e a função nele, e aponte o app para lá com um `.env.local` (modelo em `.env.example`).

Se alguém tiver editado algo direto pelo site do GitHub, rode `git pull` antes de começar, para não haver conflito.

## Atualizar o banco

Quando uma novidade precisar de algo novo no banco:

1. Crie um arquivo em `supabase/atualizacoes/` com um nome que diga a data e o assunto (por exemplo, `2026-10-notificacoes.sql`), com comandos que possam ser rodados mais de uma vez sem estragar nada (`create table if not exists`, `create or replace function`, `drop policy if exists` antes de `create policy`).
2. Coloque a mesma mudança no `setup.sql`, para quem instalar do zero.
3. No Supabase do **fargusthreads**, abra **SQL Editor** → **New query**, cole o arquivo e clique em **Run**.

Se a função `fargusgram` mudar, abra **Edge Functions** → **fargusgram** → **Code**, cole o arquivo novo e clique em **Deploy**. Confira depois se o **Verify JWT** continua desligado.

## Manter no ar

- **Pausa do Supabase:** o plano grátis pausa projetos depois de 7 dias sem uso. O robô "Manter o Supabase acordado" (`.github/workflows/keepalive.yml`) faz uma consulta a cada 3 dias. Para rodar na hora: **Actions** → "Manter o Supabase acordado" → **Run workflow**.
- **Robô desligado:** o GitHub desliga robôs agendados em repositórios públicos depois de 60 dias sem commits. Se acontecer, abra **Actions** → "Manter o Supabase acordado" → **Enable workflow**.
- **Projeto pausado mesmo assim:** entre no painel do Supabase e clique em **Restore project**. Os dados continuam lá.
- **O FargusGram também precisa ficar acordado:** se ele pausar, ninguém consegue entrar de novo no FargusThreads até ele voltar (quem já estava logado continua usando). O robô dele fica no repositório do FargusGram.

## Problemas comuns

As mensagens abaixo aparecem na tela de entrada ou num aviso do app.

| Mensagem ou sintoma | O que fazer |
| --- | --- |
| "Falta configurar o Supabase" | Preencha a URL e a chave em `src/config.js` ([passo 5](#5-ligar-o-app-ao-supabase)) |
| "A função "fargusgram" ainda não foi criada…" | Crie a função com esse nome exato ([passo 3](#3-criar-a-função-de-login)) |
| "Na função "fargusgram" do Supabase, desligue "Verify JWT"…" | Em **Edge Functions** → **fargusgram** → **Details**, desligue **Verify JWT** e salve |
| "A função está sem as chaves do Supabase…" | Apague a função e crie de novo pelo painel |
| "O banco do FargusThreads ainda não foi configurado…" ou "…está desatualizado…" | Rode o `supabase/setup.sql` de novo no SQL Editor |
| "E-mail ou senha incorretos…" | Use o e-mail e a senha do FargusGram. Se a pessoa esqueceu, o admin redefine no Painel do admin do FargusGram |
| "Esta conta do FargusGram ainda não entrou no grupo…" | A pessoa precisa terminar o cadastro no FargusGram, com o código de convite |
| "Já existe outro login com esse e-mail no Supabase do FargusThreads…" | Alguém se cadastrou por fora com esse e-mail. Apague em **Authentication** → **Users** do fargusthreads e tente de novo |
| "O FargusGram não respondeu…" | O Supabase do FargusGram pode estar pausado: entre no painel dele e clique em **Restore project** |
| "Crie um personagem no FargusGram" | A conta ainda não tem personagem. Crie lá e toque em **Já criei** |
| "Conta sem acesso" | A conta saiu do grupo no FargusGram |
| Personagem novo, foto ou nome não aparecem | Troca de personagem → **Atualizar** (ou Configurações → **Atualizar personagens**) |
| O site não abre ou mostra a versão antiga | Confira se o último "Publicar no GitHub Pages" em **Actions** ficou verde; no celular, feche e abra o app |

Para ver o que aconteceu dentro da função, abra **Edge Functions** → **fargusgram** → **Logs** no Supabase do fargusthreads.
