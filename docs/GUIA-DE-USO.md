# Guia de uso do FargusThreads

Como usar o app no dia a dia, para jogadores e para o mestre. Para colocar o app no ar, veja o [guia de publicação](DEPLOY.md).

## Entrar

- Use o **e-mail e a senha do FargusGram**. Não existe cadastro separado.
- No computador, se o FargusGram estiver aberto no mesmo navegador, toque em **Continuar com o FargusGram**.
- Na primeira vez aparecem os seus personagens e a opção **Seguir as mesmas contas**, que faz cada personagem seguir aqui quem já segue no FargusGram. Ninguém recebe aviso.
- Para instalar no celular: no iPhone, Safari → **Compartilhar** → **Adicionar à Tela de Início**; no Android, Chrome → menu ⋮ → **Instalar app**.

## Escrever

- Toque no **+** da barra de baixo, ou em "O que há de novo?" no início.
- **Fotos:** o ícone de foto adiciona até 10 por parte. O app reduz e comprime cada uma antes de enviar.
- **Enquete:** o ícone de gráfico cria uma enquete de 2 a 4 opções, com prazo de 1 hora a 7 dias. Uma parte não pode ter foto e enquete juntas.
- **Menção:** escreva **@** ou toque no ícone de @ para ver as sugestões de personagens.
- **Tópico:** toque em **› Adicionar um tópico**, ao lado do nome, na primeira parte. Um #hashtag no texto leva para a mesma página do tópico (#TorreDeFargus junta com "Torre de Fargus").
- **Sequência:** toque em **Adicionar à sequência** para escrever a próxima parte, até 10. No feed aparece a primeira, com "Ver sequência". Responder o próprio post também continua a sequência.
- **Quem pode responder:** embaixo, à esquerda, antes de publicar. Vale também para citar.
- **Trocar de personagem antes de publicar:** toque na sua foto no editor.

## Conversar

- **Para você** mostra todo mundo; **Seguindo** mostra só quem o personagem segue, incluindo os reposts deles.
- **Curtir, responder, repostar e compartilhar:** os ícones embaixo de cada post. O de setas abre **Repostar** e **Citar**.
- **Conversa completa:** toque no post para ver o que veio antes, a sequência do autor e as respostas.
- **Enquetes:** toque numa opção para votar. Depois do voto aparecem as porcentagens; o voto não pode ser trocado.
- **Salvar:** no ⋯ do post. Os salvos ficam em Configurações → **Salvos**, e só você vê.
- **Atividade do post:** no ⋯, mostra quem curtiu, repostou e citou.

## Editar e apagar

- **Editar:** no ⋯ do post, só nos primeiros 15 minutos. O post fica marcado como editado.
- **Apagar:** no ⋯ do post. Apagar a primeira parte de uma sequência apaga as seguintes. As respostas dos outros continuam, com "Respondendo a um post apagado".

## Personagens e perfil

- **Trocar de personagem:** segure o ícone do perfil na barra de baixo. Um ponto vermelho nesse ícone avisa que outro personagem seu tem novidades.
- **Personagem novo, foto ou nome:** crie ou mude no FargusGram e toque em **Atualizar** na troca de personagem (ou em Configurações → **Atualizar personagens**).
- **Bio e link:** no seu perfil, **Editar perfil**. Dá para usar a bio do FargusGram ou escrever uma só para o Threads.
- **Seguir:** pelo perfil, pela busca ou pela atividade. **Seguir as mesmas contas**, em Configurações, repete a importação do FargusGram quando quiser.

## Atividade

- O coração da barra de baixo mostra curtidas, respostas, menções, citações, reposts e novos seguidores, com filtros no topo.
- O que é novo aparece destacado e passa a lido quando você abre a tela.

## Tema

Em Configurações → **Tema**: Automático (segue o celular), Claro ou Escuro.

## Para o mestre e os admins

- **NPCs:** crie no FargusGram e toque em **Atualizar** aqui. Eles aparecem na troca de personagem, como os outros.
- **Perfil famoso:** os números extras de seguidores e curtidas definidos no Painel do admin do FargusGram valem aqui também.
- **Apagar posts dos outros:** quem é admin no FargusGram pode apagar qualquer post pelo ⋯.
- **Tirar alguém do grupo:** apague a conta no FargusGram (**Authentication** → **Users**, no Supabase de lá). Na próxima cópia dos personagens (quando alguém do grupo usa o FargusThreads, no máximo a cada 15 minutos), a pessoa sai daqui também, com tudo o que publicou.
- **Senha esquecida:** o admin redefine no Painel do admin do FargusGram.

## Privacidade

- Posts, perfis e avisos só aparecem para quem é jogador do FargusGram.
- As fotos ficam num bucket público do Supabase. O endereço de cada uma é longo e aleatório, mas quem tiver o link consegue abrir. Não publique nada sensível.
- Os salvos e os votos de cada um só o dono vê. Nas enquetes, os outros veem só as porcentagens.
- A senha só passa pelo Supabase do FargusGram. O FargusThreads recebe apenas o login já conferido.
