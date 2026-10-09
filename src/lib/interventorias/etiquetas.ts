/**
 * Qué obra supervisó o diseñó cada contrato de interventoría. Los pliegos de interventoría piden «haber ejecutado
 * interventoría que incluya …» una actividad concreta; la etiqueta confirmada a mano (con el certificado a la vista)
 * es la que cuenta, y la sugerida sale de las palabras del objeto.
 */
export const ETIQUETAS: { id: string; etiqueta: string; patron: RegExp }[] = [
  { id: "acueducto_redes", etiqueta: "Redes de acueducto", patron: /acueducto|abastecimiento|agua potable|distribuci[oó]n de agua/i },
  { id: "acueducto_matriz", etiqueta: "Línea matriz / conducción", patron: /l[ií]nea matriz|conducci[oó]n|l[ií]nea de refuerzo|refuerzo|aducci[oó]n|tuber[ií]a de gran di[aá]metro/i },
  { id: "tuberia_metalica_presion", etiqueta: "Tubería metálica a presión (acero, HD, WSP, CCP)", patron: /l[ií]nea matriz|conducci[oó]n|aducci[oó]n|juntas mec[aá]nicas|acero|hierro d[uú]ctil|\bWSP\b|\bCCP\b|PCCP/i },
  { id: "camaras_acueducto", etiqueta: "Cámaras de acueducto (concreto)", patron: /c[aá]mara|cajas? de v[aá]lvulas/i },
  { id: "estructuras_concreto", etiqueta: "Estructuras en concreto reforzado (tanques, cámaras, box culvert)", patron: /tanque|c[aá]mara|box[\s-]*culvert|estructura|pantalla|atraque/i },
  { id: "reparacion_danos", etiqueta: "Reparación de daños en tubería a presión", patron: /reparaci[oó]n de da[nñ]os|da[nñ]os puntuales|reparaciones|mantenimiento de (la )?red(es)? matriz|emergencia/i },
  { id: "pavimento", etiqueta: "Pavimento rígido o flexible", patron: /pavimento|repavimentaci|recuperaci[oó]n del espacio|reposici[oó]n de v[ií]as/i },
  { id: "alcantarillado_redes", etiqueta: "Redes de alcantarillado", patron: /alcantarillad|colector|pluvial|sanitari|aguas lluvias|aguas negras/i },
  { id: "interceptores_canales", etiqueta: "Interceptores, canales, box culvert, túneles", patron: /interceptor|canal|box[\s-]*culvert|t[uú]nel|humedal|quebrada/i },
  { id: "limpieza_redes", etiqueta: "Limpieza de redes", patron: /limpieza|mantenimiento de redes|hidrosucci|succi[oó]n|desazolve|sedimento/i },
  { id: "bombeo", etiqueta: "Bombeo / estaciones de bombeo", patron: /bombeo|bombas?\b|evacuaci[oó]n de agua/i },
  { id: "ptar_ptap", etiqueta: "Plantas de tratamiento", patron: /planta de tratamiento|PTAR|PTAP|potabilizadora/i },
  { id: "tanques", etiqueta: "Tanques de almacenamiento", patron: /tanque|reservorio|almacenamiento/i },
  { id: "sin_zanja", etiqueta: "Tecnologías sin zanja", patron: /sin zanja|trenchless|hincado|tuneler|microt[uú]nel|pipe\s*(bursting|ramming)/i },
  { id: "obra_vial", etiqueta: "Obra vial / espacio público", patron: /v[ií]a|pavimento|andenes|espacio p[uú]blico|urbanismo/i },
  { id: "gestion_social_ambiental", etiqueta: "Gestión social o ambiental", patron: /social|ambiental/i },
];

export const sugerirEtiquetas = (objeto: string): string[] => ETIQUETAS.filter((e) => e.patron.test(objeto)).map((e) => e.id);
