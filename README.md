## Organizador de Pedidos
Sistema desenvolvido para auxiliar na organização e gestão de pedidos de uma revenda de produtos de limpeza, tornando o processo mais ágil e eficiente no dia a dia do negócio.

## Visão Geral
A aplicação permite o cadastro de clientes e produtos, o lançamento e acompanhamento de pedidos, a roteirização das entregas com cálculo de rota em tempo real e o fechamento mensal das vendas, centralizando as informações de forma prática e acessível.

## Tecnologias Utilizadas
- React Native com Expo, TypeScript
- Node.js com Fastify, TypeScript, Prisma e PostgreSQL no backend
- Google Maps Platform (Geocoding, Routes e Places Autocomplete) para geocodificação e roteirização
- Sentry para monitoramento e testes de performance

## Funcionalidades
- Cadastro e gestão de clientes, com importação via CSV e geocodificação automática de endereço
- Catálogo de produtos com busca
- Lançamento e acompanhamento de pedidos
- Roteirização de entregas com Google Maps, incluindo distância e tempo estimados
- Acompanhamento de GPS ao vivo do entregador durante a rota
- Fechamento mensal e histórico de vendas

## Como Executar

### Backend
```bash
cd pedidos-lancamento-app/server
npm install
cp .env.example .env   # preencher com suas credenciais (banco, JWT, Google Maps)
npm run db:push
npm run db:seed
npm run dev
```

### App (mobile)
```bash
cd pedidos-lancamento-app
npm install
cp .env.example .env   # preencher com a URL da API e as chaves necessárias
npx expo start
```

### Build mobile (EAS)
```bash
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
```
Para o passo a passo de build e distribuição iOS via TestFlight, veja
[`pedidos-lancamento-app/BUILD_IOS.md`](pedidos-lancamento-app/BUILD_IOS.md).
