import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Shield, Send, Upload, MessageCircle, CheckCircle2 } from 'lucide-react';
import { Logo } from '../components/Logo';

const services = {
  '1': { name: 'Elétrica', emoji: '⚡' },
  '2': { name: 'Hidráulica', emoji: '💧' },
  '3': { name: 'Pintura', emoji: '🎨' },
  '4': { name: 'Marcenaria', emoji: '🔨' },
  '5': { name: 'Jardinagem', emoji: '🌳' },
  '6': { name: 'Limpeza', emoji: '✨' },
  '7': { name: 'Manutenção', emoji: '🔧' },
};

const steps = [
  { id: 1, title: 'Serviço', icon: Shield },
  { id: 2, title: 'Detalhes', icon: MessageCircle },
  { id: 3, title: 'Confirmação', icon: CheckCircle2 },
];

export function ServiceRequest() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    description: '',
    location: '',
    urgency: 'normal',
    availability: '',
  });

  const service = services[serviceId as keyof typeof services] || services['1'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      alert('Pedido enviado com sucesso!');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/">
              <Logo className="h-9" />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex items-center justify-center">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                        isActive
                          ? 'bg-primary border-primary text-white'
                          : isCompleted
                          ? 'bg-success border-success text-white'
                          : 'bg-white border-slate-200 text-slate-400'
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <span
                      className={`mt-2 text-sm font-medium ${
                        isActive ? 'text-primary' : isCompleted ? 'text-success' : 'text-muted-foreground'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-24 h-1 mx-4 rounded transition-all ${
                        isCompleted ? 'bg-success' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl border shadow-sm p-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">{service.emoji}</div>
            <h1 className="text-3xl font-bold mb-2">Solicitar {service.name}</h1>
            <p className="text-muted-foreground">
              Preencha os dados abaixo para receber orçamentos gratuitos
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {currentStep === 1 && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Nome Completo</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Seu nome completo"
                    className="w-full px-4 py-3 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">WhatsApp</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="w-full px-4 py-3 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Localização</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Cidade e bairro"
                    className="w-full px-4 py-3 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  />
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Descreva o serviço</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva em detalhes o que você precisa..."
                    rows={5}
                    className="w-full px-4 py-3 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Urgência</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'low', label: 'Sem pressa', desc: '+7 dias' },
                      { value: 'normal', label: 'Normal', desc: '2-7 dias' },
                      { value: 'high', label: 'Urgente', desc: '24-48h' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, urgency: option.value })}
                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                          formData.urgency === option.value
                            ? 'border-primary bg-primary/5'
                            : 'border-slate-200 hover:border-primary/50'
                        }`}
                      >
                        <div className="font-medium mb-1">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Disponibilidade</label>
                  <input
                    type="text"
                    value={formData.availability}
                    onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                    placeholder="Ex: Manhãs de terça e quinta"
                    className="w-full px-4 py-3 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Fotos (opcional)</label>
                  <button
                    type="button"
                    className="w-full px-4 py-8 rounded-lg border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center gap-2 text-muted-foreground"
                  >
                    <Upload className="h-8 w-8" />
                    <span>Clique para adicionar fotos</span>
                    <span className="text-xs">PNG, JPG até 10MB</span>
                  </button>
                </div>
              </>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-xl p-6 space-y-4">
                  <h3 className="font-semibold text-lg mb-4">Resumo do Pedido</h3>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Serviço:</span>
                      <span className="font-medium">{service.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nome:</span>
                      <span className="font-medium">{formData.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Telefone:</span>
                      <span className="font-medium">{formData.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Localização:</span>
                      <span className="font-medium">{formData.location}</span>
                    </div>
                    <div className="pt-3 border-t">
                      <span className="text-muted-foreground block mb-2">Descrição:</span>
                      <p className="text-sm">{formData.description}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-success/10 border border-success/30 rounded-xl p-4 flex items-start gap-3">
                  <Shield className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-success font-medium mb-1">Proteção Garantida</p>
                    <p className="text-foreground/70">
                      Seu pedido será enviado apenas para profissionais verificados e qualificados
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-4">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="flex-1 px-6 py-3 border rounded-lg font-medium hover:bg-slate-50 transition-colors"
                >
                  Voltar
                </button>
              )}
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
              >
                {currentStep === 3 ? (
                  <>
                    <Send className="h-5 w-5" />
                    Enviar Pedido
                  </>
                ) : (
                  'Continuar'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
