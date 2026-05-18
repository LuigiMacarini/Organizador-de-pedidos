import type { Product } from "./types";

export type CatalogSection = {
  category: string;
  products: Product[];
};

type Row = [id: string, name: string, unitPrice: number];

function section(category: string, rows: Row[]): CatalogSection {
  return {
    category,
    products: rows.map(([id, name, unitPrice]) => ({ id, name, unitPrice })),
  };
}

/** Catálogo agrupado por linha / categoria (espelha a lista comercial enviada). */
export const CATALOG_SECTIONS: CatalogSection[] = [
  section("Linha Aroma", [
    ["p1", "Aromatizador de Ambientes Algodão 500mL", 28.0],
    ["p2", "Aromatizador de Ambientes Amadeirado 500mL", 28.0],
    ["p3", "Aromatizador de Ambientes Limão Siciliano 500mL", 28.0],
    ["p4", "Água para Lençóis Bamboo 500mL", 34.0],
    ["p5", "Água para Lençóis Flor de Cerejeira 500mL", 34.0],
  ]),
  section("Linha Automotiva", [
    ["p6", "Detergente Automotivo 5L", 30.0],
    ["p7", "Gel para Painel 500mL", 29.0],
    ["p8", "Limpa Alumínio 5L", 38.0],
    ["p9", "Preteador de Pneu com Silicone 500mL", 26.0],
    ["p10", "Preteador para Painel e Pneu 500mL", 14.0],
    ["p11", "Solumax Desengraxante 5L", 30.0],
    ["p12", "Aromatizador de Veículo Classic 60mL", 22.0],
    ["p13", "Aromatizador de Veículo Fresh 60mL", 22.0],
  ]),
  section("Sabões e tira manchas", [
    ["p14", "Sabão Líquido Azul 5L", 30.0],
    ["p15", "Sabão de Coco 5L", 30.0],
    ["p16", "Sabão Líquido Herbal Glicerinado 5L", 30.0],
    ["p17", "Lava Roupas Quimiplus com Peróxido 5L", 32.0],
    ["p18", "Sabão Líquido com Bicarbonato Lavanda 5L", 32.0],
    ["p19", "Tira Manchas com Percarbonato", 26.0],
  ]),
  section("Alvejantes", [
    ["p20", "Água Sanitária 5L", 14.0],
    ["p21", "Água Sanitária Perfumada 5L", 21.0],
    ["p22", "Alvejante sem Cloro 5L", 25.0],
    ["p23", "Hipoclorito de Sódio 5L", 25.0],
    ["p24", "Cloro 5L", 25.0],
    ["p25", "Detergente Clorado 5L", 39.0],
  ]),
  section("Amaciantes", [
    ["p26", "Amaciante Concentrado Intenso 1L", 18.0],
    ["p27", "Amaciante Concentrado Romance 1L", 18.0],
    ["p28", "Amaciante Concentrado Carícia 1L", 18.0],
    ["p29", "Amaciante Azul 5L", 21.0],
    ["p30", "Amaciante Rosa 5L", 21.0],
    ["p31", "Amaciante Clean Branco 5L", 21.0],
    ["p32", "Amaciante Soft Amarelo 5L", 21.0],
    ["p33", "Amaciante Premium Encapsulado 5L", 23.0],
    ["p34", "Amaciante Lavanda com Óleo Essencial 5L", 28.0],
  ]),
  section("Linha Pet", [["p35", "Eliminador de Odores Mentol 5L", 27.0]]),
  section("Linha Pasta", [
    ["p36", "Pasta Mecânica", 25.0],
    ["p37", "Pasta Brilho", 25.0],
  ]),
  section("Detergentes", [
    ["p38", "Detergente Neutro 5L", 24.0],
    ["p39", "Detergente Limão 5L", 24.0],
    ["p40", "Desengordurante 5L", 32.0],
    ["p41", "Desengordurante 1L", 20.0],
  ]),
  section("Limpadores perfumados", [
    ["p42", "Limpador Perfumado Cravo e Canela 5L", 22.0],
    ["p43", "Limpador Perfumado Frutas Vermelhas 5L", 22.0],
    ["p44", "Limpador Perfumado Kaiak 5L", 22.0],
    ["p45", "Limpador Perfumado Marine 5L", 22.0],
    ["p46", "Limpador Perfumado Talco 5L", 22.0],
    ["p47", "Limpador Perfumado Bamboo 5L", 22.0],
    ["p48", "Limpador Perfumado Floral 5L", 22.0],
  ]),
  section("Multiuso e álcoois", [
    ["p49", "Multiuso Capim Limão 5L", 27.0],
    ["p50", "Multiuso Laranja 5L", 27.0],
    ["p51", "Álcool Perfumado Flores 5L", 27.0],
    ["p52", "Álcool Perfumado Rosas 5L", 27.0],
    ["p53", "Álcool Perfumado Lavanda com Hortelã 5L", 27.0],
    ["p54", "Álcool Gel 5L", 50.0],
    ["p55", "Bicarbonato + Álcool 1L", 26.0],
    ["p56", "Bicarbonato + Álcool 5L", 32.0],
  ]),
  section("Limpadores específicos", [
    ["p57", "Limpa Porcelanato 5L", 29.0],
    ["p58", "Limpa Vidros 1L", 26.0],
    ["p59", "Limpa Vidros 5L", 30.0],
    ["p60", "Limpa Obra 5L", 42.0],
    ["p61", "Limpa Pedra 5L", 30.0],
    ["p62", "Limpa Piso 5L", 22.0],
  ]),
  section("Desinfetantes", [
    ["p63", "Desinfetante Pinho 5L", 22.0],
    ["p64", "Desinfetante Citronela 5L", 22.0],
    ["p65", "Desinfetante Eucalipto 5L", 22.0],
    ["p66", "Desinfetante Lavanda 5L", 22.0],
    ["p67", "Quimiox Oxigênio Ativo 5L", 32.0],
  ]),
  section("Sabonetes", [
    ["p68", "Sabonete Líquido Erva Doce 5L", 32.0],
    ["p69", "Sabonete Líquido Vinólia 5L", 32.0],
    ["p70", "Sabonete Líquido Dovar 5L", 32.0],
    ["p71", "Sabonete Líquido Tutti Frutti", 32.0],
    ["p72", "Sabonete Líquido Frutas Vermelhas", 32.0],
  ]),
  section("Linha Premium", [
    ["p73", "Percarbonato de Sódio", 32.0],
    ["p74", "Aromatizador de Ambiente Alecrim", 44.0],
    ["p75", "Aromatizador de Ambiente Bamboo", 44.0],
    ["p76", "Aromatizador de Ambiente Roma", 44.0],
    ["p77", "Aromatizador de Ambiente Rosas Brancas", 44.0],
  ]),
];

/** Lista plana (útil para validação ou futura sincronização com API). */
export const CATALOG_ALL_PRODUCTS: Product[] = CATALOG_SECTIONS.flatMap(
  (s) => s.products
);

function productMatchesQuery(p: Product, q: string): boolean {
  const hay = `${p.name} ${p.sku ?? ""} ${p.id}`.toLowerCase();
  return hay.includes(q);
}

/** Seções filtradas; sem busca, devolve o catálogo completo agrupado. */
export function searchCatalogSections(query: string): CatalogSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return CATALOG_SECTIONS;
  return CATALOG_SECTIONS.map((sec) => ({
    category: sec.category,
    products: sec.products.filter((p) => productMatchesQuery(p, q)),
  })).filter((sec) => sec.products.length > 0);
}
