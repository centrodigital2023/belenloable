import { useState } from 'react';
import { useKV } from '@github/spark/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Stethoscope, Robot, FloppyDisk, Printer, WhatsappLogo, Envelope,
  Trash, Eye, ArrowLeft, Sparkle, NotePencil, ClipboardText,
  Users, User, Clock, WarningCircle
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

interface SignosVitales {
  temperatura: string;
  presionArterial: string;
  frecuenciaCardiaca: string;
  saturacionO2: string;
  peso: string;
}

interface FormIndividual {
  residente: string;
  fecha: string;
  turno: string;
  enfermera: string;
  signosVitales: SignosVitales;
  estadoGeneral: string;
  alimentacionHidratacion: string;
  medicacionAdministrada: string;
  incidentesNovedades: string;
  valoracionAdicional: string;
}

interface FormGrupal {
  fecha: string;
  turno: string;
  enfermera: string;
  descripcionGeneral: string;
  casosDestacados: string;
  medicacionGeneral: string;
  recomendacionesTurno: string;
}

interface NotaGuardada {
  id: string;
  tipo: 'individual' | 'grupal';
  residente: string;
  fecha: string;
  turno: string;
  notaGenerada: string;
  enfermera: string;
  creadaEn: string;
}

const TURNO_OPTIONS = [
  { value: 'mañana', label: 'Mañana (6:00 - 14:00)' },
  { value: 'tarde', label: 'Tarde (14:00 - 22:00)' },
  { value: 'noche', label: 'Noche (22:00 - 6:00)' },
];

const INITIAL_INDIVIDUAL: FormIndividual = {
  residente: '',
  fecha: new Date().toISOString().split('T')[0],
  turno: 'mañana',
  enfermera: '',
  signosVitales: {
    temperatura: '',
    presionArterial: '',
    frecuenciaCardiaca: '',
    saturacionO2: '',
    peso: '',
  },
  estadoGeneral: '',
  alimentacionHidratacion: '',
  medicacionAdministrada: '',
  incidentesNovedades: '',
  valoracionAdicional: '',
};

const INITIAL_GRUPAL: FormGrupal = {
  fecha: new Date().toISOString().split('T')[0],
  turno: 'mañana',
  enfermera: '',
  descripcionGeneral: '',
  casosDestacados: '',
  medicacionGeneral: '',
  recomendacionesTurno: '',
};

function buildDatosEstructuradosIndividual(form: FormIndividual): string {
  const sv = form.signosVitales;
  return `TIPO DE NOTA: Individual
RESIDENTE: ${form.residente || 'No especificado'}
FECHA: ${form.fecha}
TURNO: ${form.turno}
ENFERMERA RESPONSABLE: ${form.enfermera || 'No especificada'}

SIGNOS VITALES:
- Temperatura: ${sv.temperatura || 'No registrada'} °C
- Presión Arterial: ${sv.presionArterial || 'No registrada'} mmHg
- Frecuencia Cardíaca: ${sv.frecuenciaCardiaca || 'No registrada'} lpm
- Saturación de O₂: ${sv.saturacionO2 || 'No registrada'} %
- Peso: ${sv.peso || 'No registrado'} kg

ESTADO GENERAL:
${form.estadoGeneral || 'Sin observaciones registradas.'}

ALIMENTACIÓN E HIDRATACIÓN:
${form.alimentacionHidratacion || 'Sin observaciones registradas.'}

MEDICACIÓN ADMINISTRADA:
${form.medicacionAdministrada || 'Sin medicación registrada.'}

INCIDENTES O NOVEDADES:
${form.incidentesNovedades || 'Sin incidentes registrados.'}

VALORACIÓN ADICIONAL:
${form.valoracionAdicional || 'Sin valoración adicional.'}`;
}

function buildDatosEstructuradosGrupal(form: FormGrupal): string {
  return `TIPO DE NOTA: Grupal (Todos los residentes)
FECHA: ${form.fecha}
TURNO: ${form.turno}
ENFERMERA RESPONSABLE: ${form.enfermera || 'No especificada'}

DESCRIPCIÓN GENERAL DEL TURNO:
${form.descripcionGeneral || 'Sin descripción registrada.'}

CASOS DESTACADOS O CRÍTICOS:
${form.casosDestacados || 'Sin casos destacados.'}

MEDICACIÓN GENERAL ADMINISTRADA:
${form.medicacionGeneral || 'Sin medicación registrada.'}

RECOMENDACIONES PARA EL SIGUIENTE TURNO:
${form.recomendacionesTurno || 'Sin recomendaciones adicionales.'}`;
}

function buildPrompt(datosEstructurados: string): string {
  return `Eres una enfermera jefe con amplia experiencia en geriatría y redacción clínica. Tu tarea es redactar una nota de enfermería profesional en español, basada en los datos proporcionados. Debes revisar y corregir cualquier palabra, expresión o término inadecuado (como jerga vulgar, lenguaje no profesional, errores gramaticales o expresiones ambiguas) para que el texto final sea claro, preciso y respetuoso con el residente y su familia.

INSTRUCCIONES:
- Utiliza un tono profesional, cálido y comprensible.
- Corrige errores ortográficos, gramaticales o de estilo.
- Evita juicios de valor no clínicos (ej. "el residente se portó mal") y reemplázalos por descripciones objetivas (ej. "mostró agitación psicomotriz").
- Si hay información ambigua o contradictoria, prioriza la coherencia clínica.
- Incluye un encabezado con el residente (o "Todos los residentes" para nota grupal) y la fecha.
- Si es nota individual: resume los hallazgos más relevantes, destaca valores anormales, menciona la medicación administrada y finaliza con un plan de cuidados específico.
- Si es nota grupal: agrupa por hallazgos comunes, destaca casos críticos individualmente y da recomendaciones generales para el siguiente turno.
- No inventes información que no esté en los datos.

DATOS DEL CONTEXTO:

${datosEstructurados}

Redacta la nota de enfermería completa y profesional:`;
}

export default function NotaEnfermeria() {
  const [notas, setNotas] = useKV<NotaGuardada[]>('notas-enfermeria', []);
  const [tipoNota, setTipoNota] = useState<'individual' | 'grupal'>('individual');
  const [formIndividual, setFormIndividual] = useState<FormIndividual>(INITIAL_INDIVIDUAL);
  const [formGrupal, setFormGrupal] = useState<FormGrupal>(INITIAL_GRUPAL);
  const [notaGenerada, setNotaGenerada] = useState('');
  const [generando, setGenerando] = useState(false);
  const [notaVista, setNotaVista] = useState<NotaGuardada | null>(null);

  const updateIndividual = (field: keyof FormIndividual, value: string) => {
    setFormIndividual(prev => ({ ...prev, [field]: value }));
  };

  const updateSignosVitales = (field: keyof SignosVitales, value: string) => {
    setFormIndividual(prev => ({
      ...prev,
      signosVitales: { ...prev.signosVitales, [field]: value },
    }));
  };

  const updateGrupal = (field: keyof FormGrupal, value: string) => {
    setFormGrupal(prev => ({ ...prev, [field]: value }));
  };

  const generarNota = async () => {
    const datos =
      tipoNota === 'individual'
        ? buildDatosEstructuradosIndividual(formIndividual)
        : buildDatosEstructuradosGrupal(formGrupal);

    const prompt = buildPrompt(datos);
    setGenerando(true);
    setNotaGenerada('');

    try {
      if (!window.spark?.llm) {
        // Fallback when Spark LLM is not available
        setNotaGenerada(
          `NOTA DE ENFERMERÍA\n\n${tipoNota === 'individual' ? `Residente: ${formIndividual.residente}` : 'Todos los Residentes'}\nFecha: ${tipoNota === 'individual' ? formIndividual.fecha : formGrupal.fecha}\n\n[Nota generada sin IA — complete manualmente]\n\n${datos}`
        );
        toast.info('IA no disponible. Se generó una nota base para editar manualmente.');
        return;
      }

      const resultado = await window.spark.llm(prompt, 'gpt-4o', false);
      if (!resultado || typeof resultado !== 'string') {
        throw new Error('Respuesta inválida del modelo');
      }
      setNotaGenerada(resultado);
      toast.success('Nota generada correctamente con IA.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al generar la nota: ${msg}`);
    } finally {
      setGenerando(false);
    }
  };

  const guardarNota = () => {
    if (!notaGenerada.trim()) {
      toast.error('Primero genera una nota antes de guardar.');
      return;
    }

    const nuevaNota: NotaGuardada = {
      id: uuidv4(),
      tipo: tipoNota,
      residente:
        tipoNota === 'individual' ? formIndividual.residente || 'Sin nombre' : 'Todos los residentes',
      fecha: tipoNota === 'individual' ? formIndividual.fecha : formGrupal.fecha,
      turno: tipoNota === 'individual' ? formIndividual.turno : formGrupal.turno,
      notaGenerada,
      enfermera: tipoNota === 'individual' ? formIndividual.enfermera : formGrupal.enfermera,
      creadaEn: new Date().toISOString(),
    };

    setNotas([nuevaNota, ...(notas || [])]);
    toast.success('Nota guardada correctamente.');
  };

  const eliminarNota = (id: string) => {
    setNotas((notas || []).filter(n => n.id !== id));
    toast.success('Nota eliminada.');
  };

  const exportarPDF = () => {
    const ventana = window.open('', '_blank');
    if (!ventana) return;
    ventana.document.write(`
      <html><head>
        <meta charset="UTF-8">
        <title>Nota de Enfermería - Hogar Belén</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12pt; margin: 40px; color: #222; }
          h1 { color: #1a5276; font-size: 16pt; }
          pre { white-space: pre-wrap; word-break: break-word; line-height: 1.6; }
          .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 10pt; color: #666; }
        </style>
      </head><body>
        <h1>Hogar Belén — Nota de Enfermería</h1>
        <pre>${notaGenerada || (notaVista?.notaGenerada ?? '')}</pre>
        <div class="footer">Generado por el Sistema de Notas de Enfermería · Hogar Belén</div>
      </body></html>
    `);
    ventana.document.close();
    ventana.print();
  };

  const compartirWhatsApp = (nota: string) => {
    const texto = encodeURIComponent(`*Nota de Enfermería — Hogar Belén*\n\n${nota}`);
    window.open(`https://wa.me/?text=${texto}`, '_blank');
  };

  const compartirEmail = (nota: string) => {
    const asunto = encodeURIComponent('Nota de Enfermería — Hogar Belén');
    const cuerpo = encodeURIComponent(nota);
    window.location.href = `mailto:?subject=${asunto}&body=${cuerpo}`;
  };

  const notaActual = notaGenerada;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-background to-cyan-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 bg-teal-600 text-white px-6 py-3 rounded-2xl shadow-lg mb-4">
            <Stethoscope size={28} weight="bold" />
            <h1 className="text-2xl font-bold">Notas de Enfermería con IA</h1>
          </div>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Redacta notas clínicas profesionales con corrección automática de lenguaje. La IA garantiza terminología precisa y respeto al residente.
          </p>
        </div>

        <Tabs defaultValue="nueva">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="nueva" className="flex items-center gap-2">
              <NotePencil size={18} />
              Nueva Nota
            </TabsTrigger>
            <TabsTrigger value="guardadas" className="flex items-center gap-2">
              <ClipboardText size={18} />
              Notas Guardadas
              {(notas || []).length > 0 && (
                <Badge className="ml-1 bg-teal-600 text-white text-xs">
                  {(notas || []).length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── NUEVA NOTA ── */}
          <TabsContent value="nueva">
            <div className="space-y-6">
              {/* Tipo de nota */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Robot size={20} className="text-teal-600" />
                    Tipo de Nota
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setTipoNota('individual')}
                      className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                        tipoNota === 'individual'
                          ? 'border-teal-600 bg-teal-50 text-teal-800'
                          : 'border-border hover:border-teal-300 text-muted-foreground'
                      }`}
                    >
                      <User size={24} weight={tipoNota === 'individual' ? 'fill' : 'regular'} />
                      <div className="text-left">
                        <p className="font-semibold">Nota Individual</p>
                        <p className="text-xs mt-0.5 opacity-70">Para un residente específico</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setTipoNota('grupal')}
                      className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                        tipoNota === 'grupal'
                          ? 'border-teal-600 bg-teal-50 text-teal-800'
                          : 'border-border hover:border-teal-300 text-muted-foreground'
                      }`}
                    >
                      <Users size={24} weight={tipoNota === 'grupal' ? 'fill' : 'regular'} />
                      <div className="text-left">
                        <p className="font-semibold">Nota Grupal</p>
                        <p className="text-xs mt-0.5 opacity-70">Para todos los residentes</p>
                      </div>
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Formulario Individual */}
              {tipoNota === 'individual' && (
                <div className="space-y-4">
                  {/* Datos básicos */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <User size={18} className="text-teal-600" />
                        Datos del Residente
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>Nombre del Residente *</Label>
                        <Input
                          placeholder="Ej: Sr. José García"
                          value={formIndividual.residente}
                          onChange={e => updateIndividual('residente', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Enfermera Responsable</Label>
                        <Input
                          placeholder="Nombre de la enfermera"
                          value={formIndividual.enfermera}
                          onChange={e => updateIndividual('enfermera', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Fecha</Label>
                        <Input
                          type="date"
                          value={formIndividual.fecha}
                          onChange={e => updateIndividual('fecha', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Turno</Label>
                        <Select value={formIndividual.turno} onValueChange={v => updateIndividual('turno', v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TURNO_OPTIONS.map(t => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Signos Vitales */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Stethoscope size={18} className="text-teal-600" />
                        Signos Vitales
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {[
                        { field: 'temperatura' as const, label: 'Temperatura (°C)', placeholder: 'Ej: 36.5' },
                        { field: 'presionArterial' as const, label: 'Presión Arterial (mmHg)', placeholder: 'Ej: 120/80' },
                        { field: 'frecuenciaCardiaca' as const, label: 'Frec. Cardíaca (lpm)', placeholder: 'Ej: 72' },
                        { field: 'saturacionO2' as const, label: 'Saturación O₂ (%)', placeholder: 'Ej: 98' },
                        { field: 'peso' as const, label: 'Peso (kg)', placeholder: 'Ej: 65.2' },
                      ].map(({ field, label, placeholder }) => (
                        <div key={field} className="space-y-1">
                          <Label className="text-xs">{label}</Label>
                          <Input
                            placeholder={placeholder}
                            value={formIndividual.signosVitales[field]}
                            onChange={e => updateSignosVitales(field, e.target.value)}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Observaciones clínicas */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <ClipboardText size={18} className="text-teal-600" />
                        Observaciones Clínicas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {[
                        {
                          field: 'estadoGeneral' as const,
                          label: 'Estado General',
                          placeholder: 'Describe el estado de conciencia, movilidad, actitud... Ej: "el viejo estaba inquieto" → la IA lo corregirá',
                        },
                        {
                          field: 'alimentacionHidratacion' as const,
                          label: 'Alimentación e Hidratación',
                          placeholder: 'Ingesta de alimentos, líquidos, apetito...',
                        },
                        {
                          field: 'medicacionAdministrada' as const,
                          label: 'Medicación Administrada',
                          placeholder: 'Medicamentos, dosis, vía y hora de administración...',
                        },
                        {
                          field: 'incidentesNovedades' as const,
                          label: 'Incidentes o Novedades',
                          placeholder: 'Caídas, agitación, dolor, cambios de conducta... La IA corregirá términos inapropiados',
                        },
                        {
                          field: 'valoracionAdicional' as const,
                          label: 'Valoración Adicional',
                          placeholder: 'Heridas, úlceras, estado de piel, interconsultas pendientes...',
                        },
                      ].map(({ field, label, placeholder }) => (
                        <div key={field} className="space-y-1">
                          <Label>{label}</Label>
                          <Textarea
                            className="resize-none min-h-[80px]"
                            placeholder={placeholder}
                            value={formIndividual[field]}
                            onChange={e => updateIndividual(field, e.target.value)}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Formulario Grupal */}
              {tipoNota === 'grupal' && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock size={18} className="text-teal-600" />
                        Datos del Turno
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label>Fecha</Label>
                        <Input
                          type="date"
                          value={formGrupal.fecha}
                          onChange={e => updateGrupal('fecha', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Turno</Label>
                        <Select value={formGrupal.turno} onValueChange={v => updateGrupal('turno', v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TURNO_OPTIONS.map(t => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Enfermera Responsable</Label>
                        <Input
                          placeholder="Nombre de la enfermera"
                          value={formGrupal.enfermera}
                          onChange={e => updateGrupal('enfermera', e.target.value)}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <ClipboardText size={18} className="text-teal-600" />
                        Información del Turno
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {[
                        {
                          field: 'descripcionGeneral' as const,
                          label: 'Descripción General del Turno',
                          placeholder: 'Resumen del estado general de los residentes durante el turno...',
                        },
                        {
                          field: 'casosDestacados' as const,
                          label: 'Casos Destacados o Críticos',
                          placeholder: 'Residentes que requirieron atención especial, incidentes relevantes...',
                        },
                        {
                          field: 'medicacionGeneral' as const,
                          label: 'Medicación General Administrada',
                          placeholder: 'Medicamentos administrados al grupo, cambios de tratamiento...',
                        },
                        {
                          field: 'recomendacionesTurno' as const,
                          label: 'Recomendaciones para el Siguiente Turno',
                          placeholder: 'Pendientes, seguimientos, alertas para la siguiente enfermera...',
                        },
                      ].map(({ field, label, placeholder }) => (
                        <div key={field} className="space-y-1">
                          <Label>{label}</Label>
                          <Textarea
                            className="resize-none min-h-[80px]"
                            placeholder={placeholder}
                            value={formGrupal[field]}
                            onChange={e => updateGrupal(field, e.target.value)}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Botón Generar */}
              <Button
                size="lg"
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                onClick={generarNota}
                disabled={generando}
              >
                {generando ? (
                  <>
                    <Sparkle size={20} className="mr-2 animate-pulse" />
                    Generando nota con IA...
                  </>
                ) : (
                  <>
                    <Robot size={20} className="mr-2" />
                    Generar Nota con IA y Corrección de Lenguaje
                  </>
                )}
              </Button>

              {/* Nota Generada */}
              {notaActual && (
                <Card className="border-2 border-teal-200">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-teal-800">
                      <Sparkle size={18} weight="fill" className="text-teal-600" />
                      Nota Generada — Puede Editarla
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      className="min-h-[300px] font-mono text-sm resize-y leading-relaxed"
                      value={notaActual}
                      onChange={e => setNotaGenerada(e.target.value)}
                    />

                    {/* Acciones */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={guardarNota}
                        className="bg-teal-600 hover:bg-teal-700 text-white"
                      >
                        <FloppyDisk size={18} className="mr-2" />
                        Guardar Nota
                      </Button>
                      <Button variant="outline" onClick={exportarPDF}>
                        <Printer size={18} className="mr-2" />
                        Imprimir / PDF
                      </Button>
                      <Button
                        variant="outline"
                        className="text-green-700 border-green-300 hover:bg-green-50"
                        onClick={() => compartirWhatsApp(notaActual)}
                      >
                        <WhatsappLogo size={18} className="mr-2" />
                        WhatsApp
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => compartirEmail(notaActual)}
                      >
                        <Envelope size={18} className="mr-2" />
                        Email
                      </Button>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      <WarningCircle size={16} className="flex-shrink-0 mt-0.5 text-amber-600" />
                      <span>
                        La IA ha corregido el lenguaje no profesional y ha estructurado la nota según estándares clínicos.
                        Revise y ajuste el contenido antes de guardar o compartir.
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ── NOTAS GUARDADAS ── */}
          <TabsContent value="guardadas">
            {notaVista ? (
              <Card className="border-2 border-teal-200">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base text-teal-800">{notaVista.residente}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notaVista.fecha} · Turno {notaVista.turno}
                        {notaVista.enfermera && ` · Enf. ${notaVista.enfermera}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setNotaVista(null)}>
                      <ArrowLeft size={18} className="mr-1" />
                      Volver
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans bg-muted/30 p-4 rounded-lg border">
                    {notaVista.notaGenerada}
                  </pre>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={exportarPDF}>
                      <Printer size={18} className="mr-2" />
                      Imprimir / PDF
                    </Button>
                    <Button
                      variant="outline"
                      className="text-green-700 border-green-300 hover:bg-green-50"
                      onClick={() => compartirWhatsApp(notaVista.notaGenerada)}
                    >
                      <WhatsappLogo size={18} className="mr-2" />
                      WhatsApp
                    </Button>
                    <Button variant="outline" onClick={() => compartirEmail(notaVista.notaGenerada)}>
                      <Envelope size={18} className="mr-2" />
                      Email
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (notas || []).length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <ClipboardText size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No hay notas guardadas</p>
                  <p className="text-sm mt-1">Las notas que generes y guardes aparecerán aquí.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {(notas || []).map(nota => (
                  <Card key={nota.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4 flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${nota.tipo === 'individual' ? 'bg-teal-100' : 'bg-cyan-100'}`}>
                          {nota.tipo === 'individual' ? (
                            <User size={20} className="text-teal-700" />
                          ) : (
                            <Users size={20} className="text-cyan-700" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{nota.residente}</p>
                          <p className="text-xs text-muted-foreground">
                            {nota.fecha} · Turno {nota.turno}
                            {nota.enfermera && ` · Enf. ${nota.enfermera}`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                            {nota.notaGenerada.slice(0, 80)}...
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className={nota.tipo === 'individual' ? 'text-teal-700 border-teal-300' : 'text-cyan-700 border-cyan-300'}>
                          {nota.tipo === 'individual' ? 'Individual' : 'Grupal'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setNotaVista(nota)}
                          title="Ver nota"
                        >
                          <Eye size={18} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => eliminarNota(nota.id)}
                          title="Eliminar nota"
                        >
                          <Trash size={18} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
