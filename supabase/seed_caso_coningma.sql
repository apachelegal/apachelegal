-- Caso inicial del módulo Procesos: CONINGMA S.A.S. vs Consorcio Redes Norte24 (corte 8-oct-2026).
-- Ejecutar una sola vez, después de supabase/procesos.sql. Si el caso ya existe, no hace nada.

do $$
declare
  c uuid := '6f1c2a3e-8b4d-4e2a-9c1f-2026100801c0';
begin
  if exists (select 1 from casos where id = c) then
    raise notice 'El caso CONINGMA ya existe; no se insertó nada.';
    return;
  end if;

  insert into casos (id, titulo, cliente, contraparte, contrato, objeto, valor, entidad, etapa, estado, responsable, fecha_inicio, resumen, posicion)
  values (
    c,
    'CONINGMA vs Consorcio Redes Norte24 – Cerro Norte',
    'Consorcio Redes Norte24 (RL Javier Felipe Coral Santander)',
    'CONINGMA S.A.S. (NIT 901.785.898-3, RL Erica Paola Díaz Fernández)',
    '1-01-25400-1817-2024-CO-01-25 (derivado del contrato EAAB 1-01-25400-1817-2024)',
    'Obra civil para la optimización del sistema de acueducto Cerro Norte',
    14870065247,
    'EAAB-ESP · Interventoría ETC S.A.S. (contrato 1-15-25400-1818-2024)',
    'arreglo_directo',
    'activo',
    'Jurídica SAPRIN',
    '2026-10-07',
    'CONINGMA notificó incumplimiento grave del Consorcio (Cl. 18ª lit. f), invocó el art. 1609 C.C., convocó arreglo directo y pidió corte de cuentas (cartas del 5-oct a la EAAB y del 7-oct al Consorcio). La interventoría (OF-ETC-786 / INT-1818-551, 6-oct) pidió sustituirla. Desde ≈6-oct no hay personal de CONINGMA en obra (constatado por supervisión e interventoría). El 8-oct el Consorcio respondió aceptando la mesa y pidiendo información previa.',
    'Fuerte: CONINGMA recibió ≈$1.400 M de anticipo vía sus 2 proveedores y $200 M adelantados para pagar personal; no entregó el plan de choque; lo laboral es suyo (Cl. 6ª num. 19 y 20); oficios reiterados de ETC desde abril-mayo; retiró el personal antes de notificar. Débil: cambio en la forma de pago sin otrosí (Cl. 4ª Par. 7º). Rige la versión autenticada en Notaría 15 (Par. 8º: CONINGMA paga $550 M al Consorcio). Plazos: arreglo directo 15-oct; remediar ≈6-nov; terminación anticipada Cl. 19ª Par. 1º.'
  );

  insert into caso_tareas (caso_id, orden, ante_quien, accion, proposito, fecha_limite, responsable) values
    (c, 1,  'CONINGMA', 'Enviar la respuesta del Consorcio a las cartas del 5 y 7 de octubre', 'Aceptar el arreglo directo y pedir la información antes de la reunión', '2026-10-08', 'Felipe Coral'),
    (c, 2,  'Aseguradora de la póliza de cumplimiento de CONINGMA (Cl. 15ª)', 'Aviso de circunstancias con posible siniestro: abandono de obra, mora laboral, anticipo sin legalizar', 'Proteger la cobertura (art. 1075 C. Co.)', '2026-10-09', null),
    (c, 3,  'Nacional de Seguros (pólizas del contrato principal, radicado CUM_EST_1513)', 'Informar las medidas de mitigación adoptadas por el Consorcio', 'Deber de evitar la extensión del siniestro (art. 1074 C. Co.)', '2026-10-09', null),
    (c, 4,  'Aval Fiduciario', 'Pedir certificación de giros del anticipo y evaluar suspensión de nuevos giros a proveedores de CONINGMA', 'Probar el destino del dinero sin depender de CONINGMA', '2026-10-09', null),
    (c, 5,  'Los 2 proveedores designados por CONINGMA', 'Requerir informe de material entregado, ubicación y pendientes; entrega en obra de lo pagado', 'Recuperar materiales o probar que no se entregaron', '2026-10-09', null),
    (c, 6,  'Interventoría y supervisión', 'Acta de constatación del estado de obra con inventario; copia de informes, bitácora y registros de personal; aclaración del 84 % / 61 %', 'Prueba independiente del avance real y del abandono', '2026-10-09', null),
    (c, 7,  'Interventoría', 'Responder el OF-ETC-786 o pedir plazo adicional, anexando las acciones adoptadas', 'Demostrar diligencia y evitar que avance la caducidad', '2026-10-14', null),
    (c, 8,  'EAAB y supervisión', 'Comunicación con plan de contingencia: aseguramiento de frentes, refuerzo o sustitución del ejecutor y cronograma de recuperación', 'Defensa frente a la caducidad', '2026-10-09', null),
    (c, 9,  'EAAB', 'Iniciar, si el contrato principal lo exige, la aprobación de un nuevo ejecutor de obra civil', 'Continuidad de la obra sin depender de CONINGMA', '2026-10-16', null),
    (c, 10, 'Trabajadores de CONINGMA', 'Censo del personal: quiénes son y qué se les debe', 'Medir riesgo de solidaridad (art. 34 CST) y evaluar pago directo con el saldo retenido', '2026-10-09', null),
    (c, 11, 'CONINGMA', 'Mesa de arreglo directo y corte de cuentas (Cl. 21ª), con interventoría y supervisión', 'Verificar avance, actas, anticipo, personal y cuentas', '2026-10-14', null),
    (c, 12, 'CONINGMA', 'Si no llega la información el 13-oct: requerimiento de la Cl. 19ª Par. 1º (3 días hábiles)', 'Habilitar la terminación anticipada y la cláusula penal del 10 %', '2026-10-14', null),
    (c, 13, 'Cámara de Comercio (RUES)', 'Consultar certificados de los 2 proveedores y de CONINGMA', 'Detectar vinculación entre ellos', '2026-10-09', null),
    (c, 14, 'Centro de Conciliación CCB', 'Si fracasa el arreglo directo, que el Consorcio convoque la conciliación (cláusula penal, anticipo, $550 M)', 'Tomar la iniciativa', null, null);

  update caso_tareas set estado = 'completada', fecha_cumplimiento = '2026-10-08',
    soporte = 'Proyecto enviado a Felipe Coral el 8-oct para firma y envío'
  where caso_id = c and orden = 1;

  insert into caso_hechos (caso_id, fecha, fecha_texto, hecho, relevancia) values
    (c, '2025-12-12', null, 'Desembolso del anticipo del contrato principal ($5.106.246.479) por Fidubogotá', 'El saldo de $1.426 M queda destinado a materiales de obra civil (Anexo 1.1)'),
    (c, '2026-02-23', null, 'Plan de inversión y manejo del anticipo (Anexo 1.1)', 'Rubros: concretos, tuberías, aceros, pétreos, niples y materiales'),
    (c, '2026-03-20', null, 'Firma del contrato derivado', 'Corte entre pasivos anteriores (Consorcio) y posteriores (CONINGMA)'),
    (c, '2026-03-24', null, 'Reconocimiento de firmas en Notaría 15', 'Fija el texto vinculante (incluye Par. 8º)'),
    (c, null, 'Por confirmar', 'CONINGMA designa 2 proveedores que reciben ≈$1.400 M del anticipo', 'Desvirtúa la "asfixia financiera"; obliga a legalizar el anticipo'),
    (c, null, 'Por confirmar', 'Pagos de CONINGMA del Par. 8º ($200 M a la firma; $175 M con acta 2; $175 M con acta 3)', 'Si no pagó, el incumplimiento previo es suyo'),
    (c, null, 'Abr-may 2026', 'OF-ETC-455: inconsistencias en planillas de seguridad social del personal de CONINGMA', 'Mora o informalidad laboral desde la transición'),
    (c, null, 'Ago 2026', 'Mora en salarios y seguridad social del personal de CONINGMA', 'Obligación exclusiva de CONINGMA (Cl. 6ª num. 19 y 20)'),
    (c, '2026-09-08', null, 'OF-ETC-632 / INT-1818-490: atraso crítico de obra e incumplimientos reiterados', 'Prueba central del atraso, un mes antes del OF-ETC-786'),
    (c, '2026-09-18', null, 'OF-ETC-731 / INT-1818-520: medidas preventivas urgentes y plan de acción', 'Origen del plan de choque exigido'),
    (c, '2026-09-22', null, 'Derecho de petición de trabajadores por no pago de salarios', 'Riesgo de solidaridad laboral (art. 34 CST)'),
    (c, '2026-09-25', null, 'OF-ETC-745 / INT-1818-533: descargos para posible proceso de caducidad', 'Riesgo del Consorcio ante la EAAB'),
    (c, null, 'Por confirmar', 'Última acta: el Consorcio adelanta $200 M para pago de personal y condiciona el saldo al plan de choque', 'Retención con base en Cl. 6ª num. 20 y Cl. 4ª Par. 6º'),
    (c, '2026-10-05', null, 'Carta de CONINGMA a la EAAB: "notificación de terminación del vínculo"', 'Manifiesta salida; posible violación de confidencialidad (Cl. 10ª)'),
    (c, '2026-10-06', null, 'OF-ETC-786 / INT-1818-551: cuatro cargos y solicitud de sustitución de CONINGMA', 'Revisar cifra 84 % / 61 %'),
    (c, '2026-10-06', 'aprox.', 'Obra sin personal de CONINGMA, constatado por supervisión e interventoría', 'Abandono de hecho: Cl. 6ª num. 16 y Cl. 19ª num. 1'),
    (c, '2026-10-07', null, 'Carta de CONINGMA al Consorcio: incumplimiento grave, art. 1609, arreglo directo y corte de cuentas', 'Abre plazos: arreglo directo (15-oct) y 30 días para remediar'),
    (c, '2026-10-08', null, 'Respuesta del Consorcio: acepta la mesa, aclara que el contrato sigue vigente y pide información previa', 'Tono no litigioso; copia a EAAB, supervisión e interventoría');

  insert into caso_pruebas (caso_id, hecho, prueba, fuente, estado) values
    (c, 'Texto vinculante del contrato', 'Contrato autenticado en Notaría 15 y anexos 1 y 1.1', 'Consorcio', 'disponible'),
    (c, 'Giro de ≈$1.400 M a 2 proveedores de CONINGMA', 'Certificación de Aval Fiduciario; solicitudes de giro firmadas por CONINGMA', 'Fiduciaria', 'por_obtener'),
    (c, 'Destino del anticipo', 'Facturas, remisiones, actas de recibo e inventario en obra', 'Proveedores, interventoría', 'por_obtener'),
    (c, 'Vinculación de los proveedores con CONINGMA', 'Certificados de existencia y representación (RUES)', 'Cámara de Comercio', 'por_obtener'),
    (c, 'Pago (o no) de los $550 M del Par. 8º', 'Extractos y comprobantes del Consorcio', 'Consorcio', 'por_confirmar'),
    (c, 'Adelanto de $200 M y su condición', 'Comprobante de giro; acta o correo con la condición del plan de choque', 'Consorcio', 'por_confirmar'),
    (c, 'No entrega del plan de choque', 'Actas de comité; carta de CONINGMA del 7-oct (admisión)', 'Consorcio, interventoría', 'parcial'),
    (c, 'Requerimientos reiterados de la interventoría', 'OF-ETC-455, 505, 610, 632, 731, 745 y 786 con radicados', 'Interventoría, correo jurídico', 'disponible'),
    (c, 'Traslado formal de los oficios a CONINGMA', 'Correos o radicados del Consorcio a CONINGMA', 'Consorcio', 'por_confirmar'),
    (c, 'Mora salarial y de seguridad social', 'Planillas PILA; derechos de petición (22-sep)', 'Trabajadores, interventoría', 'parcial'),
    (c, 'Retiro de personal (≈6-oct)', 'Acta de constatación; informes; bitácora; fotos con fecha', 'Interventoría, supervisión', 'parcial'),
    (c, 'Divulgación a terceros', 'Carta de CONINGMA a la EAAB del 5-oct', 'CONINGMA, EAAB', 'disponible'),
    (c, 'Avance real ejecutado por CONINGMA', 'Actas parciales y cantidades medidas; aclaración del 84 % / 61 %', 'Interventoría', 'por_confirmar');
end $$;
