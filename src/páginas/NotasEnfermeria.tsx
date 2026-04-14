import { useState } from 'react';
import {
  Stethoscope,
  FileText,
  Loader2,
  Download,
  Share2,
  Save,
  Plus,
  Trash2,
  Users,
  User,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { exportToPDF, exportToWord, exportToExcel } from '@/lib/export-service';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SignosVitales {
  TA: string;
  FC: string;
  temp: string;
  SpO2: string;
  glucemia: string;
}

interface ResidenteData {
  id: string;
  nombre: string;
  edad: string;
  habitacion: string;
  signos_vitales: SignosVitales;
  nutricion: string;
  hidratacion: string;
  animo: string;
  observaciones: string;
  medicamentos: string;
  incidentes: string;
  valoraciones: string;
}

const emptySignos = (): SignosVitales => ({ TA: '', FC: '', temp: '', SpO2: '', glucemia: '' });

const emptyResidente = (): ResidenteData => ({
  id: crypto.randomUUID(),
  nombre: '',
  edad: '',
  habitacion: '',
  signos_vitales: emptySignos(),
  nutricion: '',
  hidratacion: '',
  animo: '',
  observaciones: '',
  medicamentos: '',
  incidentes: '',
  valoraciones: '',
});

// ─── AI Service ──────────────────────────────────────────────────────────────

async function generarNotaIA(residentes: ResidenteData[], turno: string, isConsolidated: boolean): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  const contexto = residentes.map((r) => ({
    residente: r.nombre || 'Sin nombre',
    edad: r.edad,
    habitacion: r.habitacion,
    fecha: new Date().toLocaleDateString('es-CO'),
    turno,
    signos_vitales: r.signos_vitales,
    nutricion: r.nutricion ? `${r.nutricion}%` : 'No registrado',
    hidratacion: r.hidratacion ? `${r.hidratacion} vasos` : 'No registrado',
    animo: r.animo || 'No registrado',
    observaciones: r.observaciones || 'Sin observaciones',
    medicamentos: r.medicamentos ? r.medicamentos.split('\n').filter(Boolean) : [],
    incidentes: r.incidentes ? r.incidentes.split('\n').filter(Boolean) : [],
    valoraciones: r.valoraciones || 'Sin valoraciones recientes',
  }));

  const systemPrompt = `Eres una enfermera jefe con amplia experiencia en geriatría. Redacta una nota de enfermería profesional en español, utilizando los datos proporcionados. La nota debe ser clara, concisa y útil para el equipo de salud y la familia.

INSTRUCCIONES:
- Incluye un encabezado con el residente (o "Todos los residentes") y la fecha.
- Si es nota individual: resume los hallazgos más relevantes, destaca cualquier valor anormal o cambio, menciona la medicación administrada y finaliza con un plan de cuidados específico.
- Si es nota grupal: agrupa por hallazgos comunes (ej. "Tres residentes presentaron hipotensión matutina"), destaca casos críticos individualmente, y da recomendaciones generales para el siguiente turno.
- Usa un lenguaje técnico pero comprensible.
- No inventes información que no esté en los datos.`;

  const userPrompt = `DATOS DEL CONTEXTO:\n${JSON.stringify(isConsolidated ? contexto : contexto[0], null, 2)}`;

  if (!apiKey || apiKey === 'undefined') {
    // Fallback demo note when no API key is configured
    return generarNotaDemo(residentes[0], turno, isConsolidated, residentes);
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4',
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Error OpenAI: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function generarNotaDemo(
  residente: ResidenteData,
  turno: string,
  isConsolidated: boolean,
  todos: ResidenteData[]
): string {
  const fecha = new Date().toLocaleDateString('es-CO');
  if (!isConsolidated) {
    return `NOTA DE ENFERMERÍA
Residente: ${residente.nombre || 'Sin nombre'}${residente.habitacion ? ` – Habitación ${residente.habitacion}` : ''}
Fecha: ${fecha} – Turno ${turno}

Signos vitales: TA ${residente.signos_vitales.TA || 'N/R'}, FC ${residente.signos_vitales.FC || 'N/R'}, Temp ${residente.signos_vitales.temp || 'N/R'}°C, SpO₂ ${residente.signos_vitales.SpO2 || 'N/R'}%, Glucemia ${residente.signos_vitales.glucemia || 'N/R'} mg/dL.
${residente.nutricion ? `Ingesta de alimentos: ${residente.nutricion}%.` : ''}${residente.hidratacion ? ` Hidratación: ${residente.hidratacion} vasos.` : ''}
Estado de ánimo: ${residente.animo || 'No registrado'}.${residente.observaciones ? `\nObservaciones: ${residente.observaciones}.` : ''}
${residente.medicamentos ? `Medicamentos administrados:\n${residente.medicamentos}` : 'Sin medicamentos registrados en este turno.'}
${residente.incidentes ? `Incidentes:\n${residente.incidentes}` : 'Sin incidentes registrados.'}

Plan de cuidados: Continuar con seguimiento de constantes vitales. Se sugiere reevaluar en el próximo turno.

(Nota generada en modo demo – configure VITE_OPENAI_API_KEY para generar con IA.)`;
  }

  const nombresResidentes = todos.map((r) => r.nombre || 'Sin nombre').join(', ');
  return `RESUMEN DE ENFERMERÍA – TURNO ${turno.toUpperCase()} (${fecha})

Se atendieron ${todos.length} residentes: ${nombresResidentes}.

Hallazgos relevantes por residente:
${todos
  .map(
    (r) =>
      `• ${r.nombre || 'Sin nombre'}: ${r.observaciones || 'Sin novedades registradas.'}${r.incidentes ? ` Incidentes: ${r.incidentes}` : ''}`
  )
  .join('\n')}

Recomendaciones para el siguiente turno:
- Continuar con el plan de cuidados habitual para cada residente.
- Verificar adherencia a medicación y registrar cualquier cambio en el estado clínico.

(Nota generada en modo demo – configure VITE_OPENAI_API_KEY para generar con IA.)`;
}

// ─── Subcomponent: ResidenteForm ─────────────────────────────────────────────

interface ResidenteFormProps {
  data: ResidenteData;
  onChange: (data: ResidenteData) => void;
  onRemove?: () => void;
  showRemove?: boolean;
  index?: number;
}

function ResidenteForm({ data, onChange, onRemove, showRemove, index }: ResidenteFormProps) {
  const [expanded, setExpanded] = useState(index === 0);

  const update = (field: keyof ResidenteData, value: string) =>
    onChange({ ...data, [field]: value });

  const updateSignos = (field: keyof SignosVitales, value: string) =>
    onChange({ ...data, signos_vitales: { ...data.signos_vitales, [field]: value } });

  return (
    <Card className="border border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-2 text-left flex-1"
            onClick={() => setExpanded((e) => !e)}
          >
            <User size={16} className="text-blue-600 flex-shrink-0" />
            <span className="font-medium text-sm">
              {data.nombre || `Residente ${(index ?? 0) + 1}`}
            </span>
            {expanded ? <ChevronUp size={16} className="ml-auto" /> : <ChevronDown size={16} className="ml-auto" />}
          </button>
          {showRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive ml-2"
              onClick={onRemove}
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Identification */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre completo</Label>
              <Input
                value={data.nombre}
                onChange={(e) => update('nombre', e.target.value)}
                placeholder="María González"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Edad</Label>
              <Input
                value={data.edad}
                onChange={(e) => update('edad', e.target.value)}
                placeholder="82 años"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Habitación</Label>
              <Input
                value={data.habitacion}
                onChange={(e) => update('habitacion', e.target.value)}
                placeholder="101"
              />
            </div>
          </div>

          <Separator />

          {/* Vital signs */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Signos Vitales
            </p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { key: 'TA' as const, label: 'TA (mmHg)', placeholder: '120/80' },
                { key: 'FC' as const, label: 'FC (lpm)', placeholder: '72' },
                { key: 'temp' as const, label: 'Temp (°C)', placeholder: '36.5' },
                { key: 'SpO2' as const, label: 'SpO₂ (%)', placeholder: '97' },
                { key: 'glucemia' as const, label: 'Glucemia', placeholder: '95' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    value={data.signos_vitales[key]}
                    onChange={(e) => updateSignos(key, e.target.value)}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Nutrition & mood */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nutrición (% ingesta)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={data.nutricion}
                onChange={(e) => update('nutricion', e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hidratación (vasos)</Label>
              <Input
                type="number"
                min={0}
                value={data.hidratacion}
                onChange={(e) => update('hidratacion', e.target.value)}
                placeholder="8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado de ánimo</Label>
              <Input
                value={data.animo}
                onChange={(e) => update('animo', e.target.value)}
                placeholder="Tranquilo, ansioso..."
              />
            </div>
          </div>

          {/* Observations */}
          <div className="space-y-1">
            <Label className="text-xs">Observaciones / bitácora</Label>
            <Textarea
              rows={2}
              value={data.observaciones}
              onChange={(e) => update('observaciones', e.target.value)}
              placeholder="Dolor lumbar al levantarse, buen estado general..."
            />
          </div>

          {/* Medications */}
          <div className="space-y-1">
            <Label className="text-xs">Medicamentos administrados (uno por línea)</Label>
            <Textarea
              rows={2}
              value={data.medicamentos}
              onChange={(e) => update('medicamentos', e.target.value)}
              placeholder="Paracetamol 500mg a las 7:00&#10;Enalapril 10mg a las 8:00"
            />
          </div>

          {/* Incidents & assessments */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Incidentes (uno por línea)</Label>
              <Textarea
                rows={2}
                value={data.incidentes}
                onChange={(e) => update('incidentes', e.target.value)}
                placeholder="Caída sin lesiones a las 9:30..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valoraciones (Barthel, Fried, etc.)</Label>
              <Textarea
                rows={2}
                value={data.valoraciones}
                onChange={(e) => update('valoraciones', e.target.value)}
                placeholder="Barthel: 60, Fried: prefrágil"
              />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NotasEnfermeria() {
  const [mode, setMode] = useState<'individual' | 'grupal'>('individual');
  const [turno, setTurno] = useState<'mañana' | 'tarde' | 'noche'>('mañana');
  const [residentes, setResidentes] = useState<ResidenteData[]>([emptyResidente()]);
  const [nota, setNota] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isConsolidated = mode === 'grupal';
  const activeResidentes = isConsolidated ? residentes : residentes.slice(0, 1);

  const noteTitle =
    isConsolidated
      ? `Resumen Enfermería – Turno ${turno} – ${new Date().toLocaleDateString('es-CO')}`
      : `Nota Enfermería – ${activeResidentes[0]?.nombre || 'Residente'} – Turno ${turno}`;

  const handleGenerate = async () => {
    const filled = activeResidentes.filter((r) => r.nombre.trim());
    if (filled.length === 0) {
      toast.error('Ingresa al menos el nombre de un residente.');
      return;
    }
    setLoading(true);
    try {
      const result = await generarNotaIA(filled, turno, isConsolidated);
      setNota(result);
      toast.success('Nota generada correctamente.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al generar la nota.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!nota.trim()) {
      toast.error('Genera una nota antes de guardar.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('nursing_notes').insert({
        resident_id: isConsolidated ? null : (activeResidentes[0]?.id ?? null),
        date: new Date().toISOString().split('T')[0],
        shift: turno,
        note: nota,
        is_consolidated: isConsolidated,
      });
      if (error) throw error;
      toast.success('Nota guardada en la base de datos.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al guardar la nota.');
    } finally {
      setSaving(false);
    }
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`${noteTitle}\n\n${nota.slice(0, 500)}...`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareEmail = () => {
    const subject = encodeURIComponent(noteTitle);
    const body = encodeURIComponent(nota);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const addResidente = () => setResidentes((prev) => [...prev, emptyResidente()]);

  const updateResidente = (idx: number, data: ResidenteData) =>
    setResidentes((prev) => prev.map((r, i) => (i === idx ? data : r)));

  const removeResidente = (idx: number) =>
    setResidentes((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-background to-indigo-50 py-10">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <Stethoscope size={32} className="text-blue-200" />
            <div>
              <h1 className="text-2xl font-bold">Notas de Enfermería IA</h1>
              <p className="text-blue-100 text-sm">Hogar Belén – Gestión clínica asistida por inteligencia artificial</p>
            </div>
          </div>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'individual' | 'grupal')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual" className="flex items-center gap-2">
              <User size={16} /> Nota Individual
            </TabsTrigger>
            <TabsTrigger value="grupal" className="flex items-center gap-2">
              <Users size={16} /> Nota Grupal / Consolidada
            </TabsTrigger>
          </TabsList>

          {/* ── Shared form body ── */}
          {['individual', 'grupal'].map((tabValue) => (
            <TabsContent key={tabValue} value={tabValue} className="space-y-4 mt-4">
              {/* Shift selector */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Configuración del Turno</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Label className="text-sm whitespace-nowrap">Turno de trabajo:</Label>
                    <Select value={turno} onValueChange={(v) => setTurno(v as typeof turno)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mañana">Mañana</SelectItem>
                        <SelectItem value="tarde">Tarde</SelectItem>
                        <SelectItem value="noche">Noche</SelectItem>
                      </SelectContent>
                    </Select>
                    <Badge variant="outline" className="text-blue-700 border-blue-300">
                      {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Resident forms */}
              <div className="space-y-3">
                {(tabValue === 'individual' ? residentes.slice(0, 1) : residentes).map((r, idx) => (
                  <ResidenteForm
                    key={r.id}
                    data={r}
                    index={idx}
                    onChange={(data) => updateResidente(idx, data)}
                    showRemove={tabValue === 'grupal' && residentes.length > 1}
                    onRemove={() => removeResidente(idx)}
                  />
                ))}
              </div>

              {tabValue === 'grupal' && (
                <Button variant="outline" className="w-full border-dashed" onClick={addResidente}>
                  <Plus size={16} className="mr-2" />
                  Agregar otro residente
                </Button>
              )}

              {/* Generate button */}
              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                size="lg"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    Generando nota con IA…
                  </>
                ) : (
                  <>
                    <FileText size={18} className="mr-2" />
                    Generar Nota de Enfermería
                  </>
                )}
              </Button>
            </TabsContent>
          ))}
        </Tabs>

        {/* ── Generated note ── */}
        {nota && (
          <Card className="border-2 border-blue-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <FileText size={20} />
                Nota Generada
              </CardTitle>
              <CardDescription>
                Revisa y edita el texto antes de guardar o exportar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                className="min-h-[300px] font-mono text-sm leading-relaxed"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                  Guardar
                </Button>

                <Button
                  variant="outline"
                  onClick={() => exportToPDF(nota, noteTitle)}
                >
                  <Download size={16} className="mr-2" />
                  PDF
                </Button>

                <Button
                  variant="outline"
                  onClick={() => exportToWord(nota, noteTitle)}
                >
                  <Download size={16} className="mr-2" />
                  Word
                </Button>

                <Button
                  variant="outline"
                  onClick={() =>
                    exportToExcel(nota, noteTitle, {
                      Turno: turno,
                      Tipo: isConsolidated ? 'Consolidada' : 'Individual',
                      Residentes: activeResidentes.map((r) => r.nombre).join(', '),
                    })
                  }
                >
                  <Download size={16} className="mr-2" />
                  Excel
                </Button>

                <Separator orientation="vertical" className="h-9" />

                <Button variant="ghost" onClick={shareWhatsApp} className="text-green-600">
                  <MessageCircle size={16} className="mr-2" />
                  WhatsApp
                </Button>

                <Button variant="ghost" onClick={shareEmail} className="text-blue-600">
                  <Mail size={16} className="mr-2" />
                  Email
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Share2 size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                <strong>¿Cómo funciona?</strong> El sistema recopila los datos clínicos del turno
                y los envía a GPT-4 con un prompt especializado en geriatría para generar una nota
                de enfermería profesional. La nota puede editarse, guardarse en el historial del
                residente y exportarse en múltiples formatos.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
