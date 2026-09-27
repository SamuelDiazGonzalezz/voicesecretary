export const scenarios = [
  {
    id: 'clinica',
    label: 'Clínica',
    context: 'Reserva de una primera consulta',
    caller: 'Marta G.',
    duration: '01:42',
    lines: [
      {
        role: 'assistant',
        text: 'Clínica Horizonte, soy NORA, la asistente virtual. ¿En qué puedo ayudarte?',
      },
      {
        role: 'caller',
        text: 'Quiero reservar una primera consulta para esta semana.',
      },
      {
        role: 'assistant',
        text: 'Claro. El jueves tengo disponibilidad a las diez y media o a las cinco. ¿Qué hora prefieres?',
      },
      {
        role: 'caller',
        text: 'A las diez y media me viene perfecto.',
      },
      {
        role: 'assistant',
        text: 'Listo, Marta. Tu cita queda confirmada para el jueves a las diez y media. Te envío los detalles ahora mismo.',
      },
    ],
    actions: [
      ['Intención detectada', 'Nueva cita'],
      ['Agenda consultada', '2 huecos disponibles'],
      ['Cita creada', 'Jue · 10:30'],
      ['Confirmación enviada', 'SMS al cliente'],
    ],
  },
  {
    id: 'inmobiliaria',
    label: 'Inmobiliaria',
    context: 'Cualificación de un comprador',
    caller: 'Carlos R.',
    duration: '02:18',
    lines: [
      {
        role: 'assistant',
        text: 'Inmobiliaria Norte, soy NORA, la asistente virtual. ¿Sobre qué vivienda llamas?',
      },
      {
        role: 'caller',
        text: 'Sobre el ático de la calle Alcalá. Me gustaría visitarlo.',
      },
      {
        role: 'assistant',
        text: 'Perfecto. Antes de coordinar la visita, ¿la compra sería para vivienda habitual y ya tienes financiación revisada?',
      },
      {
        role: 'caller',
        text: 'Sí, sería vivienda habitual y ya tengo la financiación aprobada.',
      },
      {
        role: 'assistant',
        text: 'Gracias, Carlos. He enviado tu solicitud al agente responsable, que te confirmará la visita esta tarde.',
      },
    ],
    actions: [
      ['Propiedad identificada', 'REF · AT-204'],
      ['Contacto cualificado', 'Financiación aprobada'],
      ['Lead actualizado', 'Prioridad alta'],
      ['Agente avisado', 'Seguimiento hoy'],
    ],
  },
  {
    id: 'servicios',
    label: 'Servicios',
    context: 'Aviso urgente fuera de horario',
    caller: 'Lucía P.',
    duration: '01:56',
    lines: [
      {
        role: 'assistant',
        text: 'Servicio técnico Atlas, soy NORA, la asistente virtual. Cuéntame qué ha ocurrido.',
      },
      {
        role: 'caller',
        text: 'Tenemos una fuga de agua en el local y necesitamos ayuda urgente.',
      },
      {
        role: 'assistant',
        text: 'Entendido. Voy a registrar el aviso como urgente. ¿La llave de paso está cerrada y el agua se encuentra lejos de cuadros eléctricos?',
      },
      {
        role: 'caller',
        text: 'Sí, ya está cerrada y no hay riesgo eléctrico.',
      },
      {
        role: 'assistant',
        text: 'Perfecto. El técnico de guardia ya tiene el aviso y te llamará en los próximos minutos.',
      },
    ],
    actions: [
      ['Urgencia detectada', 'Fuga activa'],
      ['Protocolo aplicado', 'Riesgo controlado'],
      ['Parte generado', 'SAT-1842'],
      ['Guardia avisada', 'Derivación prioritaria'],
    ],
  },
  {
    id: 'restauracion',
    label: 'Restauración',
    context: 'Reserva para un grupo',
    caller: 'Daniel S.',
    duration: '01:34',
    lines: [
      {
        role: 'assistant',
        text: 'Restaurante Brasa, soy NORA, la asistente virtual. ¿Quieres hacer una reserva?',
      },
      {
        role: 'caller',
        text: 'Sí, para ocho personas este sábado por la noche.',
      },
      {
        role: 'assistant',
        text: 'Tengo una mesa a las nueve y cuarto. ¿Hay alguna alergia o necesitáis espacio para un carrito?',
      },
      {
        role: 'caller',
        text: 'Una persona es celíaca, nada más.',
      },
      {
        role: 'assistant',
        text: 'Anotado. La mesa queda reservada a nombre de Daniel para ocho personas, el sábado a las nueve y cuarto.',
      },
    ],
    actions: [
      ['Disponibilidad revisada', 'Mesa para 8'],
      ['Preferencia registrada', 'Opción sin gluten'],
      ['Reserva confirmada', 'Sáb · 21:15'],
      ['Equipo informado', 'Nota en comanda'],
    ],
  },
];

export const sectors = [
  {
    number: '01',
    title: 'Clínicas y centros médicos',
    text: 'Gestiona citas, cambios, recordatorios y preguntas frecuentes con criterios definidos por tu equipo.',
    tags: ['Agenda', 'Recordatorios', 'Derivación'],
  },
  {
    number: '02',
    title: 'Inmobiliarias',
    text: 'Identifica el inmueble, cualifica la oportunidad y coordina el siguiente paso sin fricción.',
    tags: ['Leads', 'Visitas', 'CRM'],
  },
  {
    number: '03',
    title: 'Servicios profesionales',
    text: 'Recoge el contexto, aplica protocolos y escala avisos urgentes a la persona correcta.',
    tags: ['Incidencias', 'Guardias', 'Resúmenes'],
  },
  {
    number: '04',
    title: 'Hostelería y restauración',
    text: 'Resuelve reservas, horarios, grupos y preferencias incluso durante los momentos de mayor actividad.',
    tags: ['Reservas', 'Alergias', 'Confirmaciones'],
  },
];

export const dashboardCalls = [
  ['10:42', 'Marta G.', 'Nueva cita', 'Confirmada', '01:42'],
  ['10:36', 'Carlos R.', 'Visita inmueble', 'Derivada', '02:18'],
  ['10:21', 'Lucía P.', 'Aviso urgente', 'Escalada', '01:56'],
  ['10:04', 'Daniel S.', 'Reserva grupo', 'Confirmada', '01:34'],
];
