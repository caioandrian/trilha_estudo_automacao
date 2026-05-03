# Trilha básica — Lógica & automação de testes

**[Abrir a trilha no navegador (GitHub Pages)](https://caioandrian.github.io/trilha_estudo_automacao/)**

Aplicação estática em HTML, CSS e JavaScript: teoria, questões com gabarito, desafios de raciocínio sobre código, checklist de passos práticos (por exemplo Cypress e Git) e painel de desafios com o site Sauce Demo. O progresso e as marcações da checklist ficam salvos no **localStorage** do seu navegador.

## Objetivo

A trilha serve como roteiro introdutório para quem está começando em **qualidade de software** e **automação de testes**, com ênfase em bases de **JavaScript** (léxico da linguagem que aparece em stacks como Cypress), **ambiente navegador**, ferramenta **Cypress** (conceitos, comandos e um fluxo hands-on) e **Git/GitHub** para versionar e publicar o projeto. O formato é autoinstrutivo: você lê a teoria quando existir, responde no próprio site e marca o que já fez na sua máquina nas checklists.

## Contextos e tópicos

Os tópicos aparecem na barra lateral agrupados por **contexto**. Esta é a organização atual (conforme `data/trilha.json`):

### Lógica de programação

| Tópico | Conteúdo em linha grossa |
| --- | --- |
| **Javascript** | Variáveis (`let`/`const`), tipos, arrays, condicionais, loops — fundamentos para ler e escrever testes em JS. |
| **Navegador** | `localStorage`, `sessionStorage`, serialização JSON — útil para entender persistência e limites em automação. |
| **Desafios: o código roda?** | Questões estilo “o que acontece se rodar este trecho?” para fixar comportamento da linguagem. |

### Cypress / Automação de teste

| Tópico | Conteúdo em linha grossa |
| --- | --- |
| **Cypress: conceitos e interface** | O que é o Cypress, Test Runner, fila de comandos, `cy.get`, boas práticas de espera. |
| **Cypress: comandos práticos** | `visit`, seleção de elementos, asserções, `intercept`, `wait` com alias de rede, etc. |
| **Cypress: novo projeto do zero** | Checklist para instalar Node/NPM, criar projeto, `npx cypress open` e estrutura de pastas; bloco **Sauce Demo (Swag Labs)** com passos e código de referência para login e carrinho. |

### GitHub / Versionamento

| Tópico | Conteúdo em linha grossa |
| --- | --- |
| **GitHub: enviar seu projeto** | Checklist: configurar Git, `init`, `.gitignore`, commit, criar repositório remoto, `remote`, branch `main`, `push`. |

## Rodar localmente

Por restrição de navegador, `fetch` do `data/trilha.json` não funciona em `file://`. Sirva a pasta do repositório com um servidor local (por exemplo `npx serve` na raiz do projeto ou a extensão Live Server no editor) e abra a URL indicada no terminal.

## Publicação

O repositório pode usar **GitHub Actions** (workflow em `.github/workflows/pages.yml`) para publicar o conteúdo estático em **GitHub Pages**; a versão em produção está no link no topo deste README.
