import React, { useState } from 'react';
import { Initiative } from '../../types';
import { usePlatformStore } from '../../store/state';
import { CheckCircle2, AlertCircle, X, ArrowLeft, ArrowRight, Gauge, Building2, Info, RotateCcw } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface PreEligibilityModalProps {
  initiative: Initiative;
  onClose: () => void;
  onProceedToApply: () => void;
}

export const PreEligibilityModal: React.FC<PreEligibilityModalProps> = ({
  initiative,
  onClose,
  onProceedToApply
}) => {
  const { language } = usePlatformStore();
  const isAr = language === 'ar';

  // مفتاح ثابت لكل سؤال: أسئلة قديمة من الأدمن بلا id كانت تتشارك answers[undefined]
  // ونفس name للراديو — إجابة سؤال كانت تجيب الباقي.
  const questions = (initiative.preEligibilityQuestions || []).map((q, idx) => ({ ...q, key: q.id || `q-${idx}` }));
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleAnswerChange = (key: string, value: any) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const isAnswered = (key: string) => {
    const v = answers[key];
    return v !== undefined && v !== null && v !== '';
  };
  const answeredCount = questions.filter(q => isAnswered(q.key)).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  const isMatch = (q: (typeof questions)[number]): boolean => {
    const userAns = answers[q.key];
    if (q.type === 'boolean') return userAns === (q.expectedValue ?? true);
    if (q.type === 'select') return !!q.options?.find(o => o.value === userAns)?.isEligible;
    if (q.type === 'number') {
      const expected = String(q.expectedValue ?? '').trim();
      if (expected === '') return isAnswered(q.key);
      const min = Number(expected);
      // قيمة متوقعة رقمية = حد أدنى؛ غير ذلك مطابقة نصية
      return Number.isFinite(min) ? Number(userAns) >= min : String(userAns).trim() === expected;
    }
    return false;
  };

  // مؤهل فقط إذا تحققت كل الشروط (كانت length - 1 تجعل سؤالاً واحداً «مؤهل» دائماً)
  const calculateEligibility = () => {
    const unmet = questions.filter(q => !isMatch(q));
    const matches = questions.length - unmet.length;
    return {
      score: Math.round((matches / (questions.length || 1)) * 100),
      isEligible: unmet.length === 0,
      unmet,
    };
  };

  const result = submitted ? calculateEligibility() : null;

  const handleReset = () => {
    setAnswers({});
    setSubmitted(false);
  };

  return (
    <Modal onClose={onClose} maxWidth="680px" title={
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <div style={{ background: 'var(--gov-gold-light)', padding: '0.4rem', borderRadius: 'var(--radius-sm)', color: 'var(--gov-gold-dark)', flexShrink: 0 }}>
          <Gauge size={20} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="elig-title" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--gov-primary-900)' }}>
            {isAr ? 'حاسبة وفحص الأهلية المسبق الفوري' : 'Instant Pre-Eligibility Assessment'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isAr ? initiative.titleAr : initiative.titleEn}
          </div>
        </div>
      </div>
    }>
      {/* Mobile-first responsive rules for the eligibility flow */}
      <style>{`
        .elig-body { padding: 0; }
        .elig-question { padding: 1rem; }
        .elig-radio-row { display: flex; gap: 0.75rem; }
        .elig-radio-label {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.45rem;
          cursor: pointer; font-size: 0.875rem; font-weight: 700;
          border: 1.5px solid var(--border-subtle); border-radius: var(--radius-md);
          padding: 0.7rem 0.5rem; background: var(--bg-surface); color: var(--text-secondary);
          transition: all 0.15s ease; min-height: 44px; text-align: center;
        }
        .elig-radio-label input { accent-color: var(--egypt-red); width: 17px; height: 17px; flex-shrink: 0; }
        .elig-radio-label.picked { border-color: var(--egypt-red); background: var(--egypt-red-soft); color: var(--egypt-red); }
        .elig-footer {
          display: flex; gap: 0.6rem; align-items: center; justify-content: flex-end;
          padding: 0.9rem 1.25rem; border-top: 1px solid var(--border-subtle);
          background: var(--bg-muted); flex-wrap: wrap;
        }
        .elig-footer .btn { min-height: 44px; }
        .elig-progress { font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-inline-end: auto; }
        @media (max-width: 600px) {
          .elig-title { font-size: 1rem !important; }
          .elig-question { padding: 0.8rem !important; }
          .elig-radio-row { flex-direction: column; gap: 0.5rem; }
          .elig-footer { flex-direction: column-reverse; align-items: stretch; padding: 0.8rem; }
          .elig-footer .btn { width: 100%; justify-content: center; }
          .elig-progress { margin: 0 0 0.2rem 0; text-align: center; width: 100%; }
        }
      `}</style>

      {/* Body */}
      {!submitted ? (
        <div className="elig-body">
          <p style={{ fontSize: '0.9rem', color: 'var(--text-body)', marginBottom: '1.25rem', lineHeight: 1.7 }}>
            {isAr
              ? 'أجب على الأسئلة السريعة التالية لتحديد مدى توافق منشأتك الصناعية مع شروط وضوابط المبادرة قبل البدء في رفع المستندات الرسمية:'
              : 'Answer the following quick questions to verify your factory compliance with the initiative criteria before uploading formal documents:'}
          </p>

          {questions.length === 0 ? (
            <div className="card" style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {isAr ? 'لا توجد أسئلة أهلية مسبقة لهذه المبادرة — يمكنك المتابعة للتقديم مباشرة.' : 'No pre-eligibility questions for this initiative — you can proceed to apply directly.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {questions.map((q, idx) => (
                <div
                  key={q.key}
                  className="elig-question"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    border: isAnswered(q.key) ? '1.5px solid var(--egypt-red)' : '1px solid var(--border-subtle)',
                    background: 'var(--bg-app)'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--gov-primary-900)', marginBottom: '0.6rem', lineHeight: 1.6 }}>
                    {idx + 1}. {(isAr ? q.questionAr : q.questionEn) || q.questionAr || q.questionEn}
                  </div>

                  {q.type === 'boolean' && (
                    <div className="elig-radio-row">
                      <label className={`elig-radio-label${answers[q.key] === true ? ' picked' : ''}`}>
                        <input
                          type="radio"
                          name={`elig-${q.key}`}
                          checked={answers[q.key] === true}
                          onChange={() => handleAnswerChange(q.key, true)}
                        />
                        <span>{isAr ? 'نعم، مطابق' : 'Yes, Compliant'}</span>
                      </label>
                      <label className={`elig-radio-label${answers[q.key] === false ? ' picked' : ''}`}>
                        <input
                          type="radio"
                          name={`elig-${q.key}`}
                          checked={answers[q.key] === false}
                          onChange={() => handleAnswerChange(q.key, false)}
                        />
                        <span>{isAr ? 'لا / غير متوفر' : 'No / Not Available'}</span>
                      </label>
                    </div>
                  )}

                  {q.type === 'select' && (
                    <select
                      className="form-control"
                      value={answers[q.key] || ''}
                      onChange={e => handleAnswerChange(q.key, e.target.value)}
                      style={{ marginTop: '0.3rem', minHeight: '44px' }}
                    >
                      <option value="">{isAr ? '-- اختر الإجابة --' : '-- Select Option --'}</option>
                      {q.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {isAr ? opt.labelAr : opt.labelEn}
                        </option>
                      ))}
                    </select>
                  )}

                  {q.type === 'number' && (
                    <input
                      type="number"
                      inputMode="decimal"
                      className="form-control"
                      dir="ltr"
                      value={answers[q.key] ?? ''}
                      onChange={e => handleAnswerChange(q.key, e.target.value)}
                      placeholder={isAr ? 'أدخل الرقم' : 'Enter a number'}
                      style={{ marginTop: '0.3rem', minHeight: '44px' }}
                    />
                  )}

                  {(q.explanationAr || q.explanationEn) && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.45rem', lineHeight: 1.6 }}>
                      <Info size={13} style={{ color: 'var(--gov-gold-dark)', flexShrink: 0, marginTop: '0.15rem' }} />
                      <span>{isAr ? q.explanationAr : q.explanationEn}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '1.25rem 0' }}>
          {result?.isEligible ? (
            <div>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'var(--status-approved-bg)', color: 'var(--status-approved-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', border: '2px solid var(--status-approved-bd)' }}>
                <CheckCircle2 size={36} />
              </div>
              <h4 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--status-approved-text)', marginBottom: '0.5rem' }}>
                {isAr ? 'منشأتك مؤهلة للتقديم بنسبة عالية!' : 'Your Factory is Highly Eligible!'}
              </h4>
              <div style={{ display: 'inline-block', fontSize: '0.8rem', fontWeight: 800, color: 'var(--status-approved-text)', background: 'var(--status-approved-bg)', border: '1px solid var(--status-approved-bd)', borderRadius: '9999px', padding: '0.25rem 0.9rem', marginBottom: '0.75rem' }}>
                {isAr ? `نسبة التوافق: ${result.score}%` : `Match score: ${result.score}%`}
              </div>
              <p style={{ color: 'var(--text-body)', fontSize: '0.92rem', maxWidth: '480px', margin: '0 auto 1.25rem auto', lineHeight: 1.7 }}>
                {isAr
                  ? `بناءً على إجاباتك، تتطابق بيانات مصنعك مع شروط وضوابط مبادرة (${initiative.titleAr}). يمكنك الآن المتابعة لتقديم الطلب الرسمي.`
                  : `Based on your answers, your facility matches ${initiative.titleEn} criteria. You can now proceed to submit the official application.`}
              </p>
            </div>
          ) : (
            <div>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'var(--gov-crimson-light)', color: 'var(--gov-crimson)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', border: '2px solid var(--gov-crimson-border)' }}>
                <AlertCircle size={36} />
              </div>
              <h4 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--gov-crimson)', marginBottom: '0.5rem' }}>
                {isAr ? 'تنبيه: قد تحتاج لاستيفاء بعض الشروط' : 'Attention: Additional Requirements Needed'}
              </h4>
              <div style={{ display: 'inline-block', fontSize: '0.8rem', fontWeight: 800, color: 'var(--gov-crimson)', background: 'var(--gov-crimson-light)', border: '1px solid var(--gov-crimson-border)', borderRadius: '9999px', padding: '0.25rem 0.9rem', marginBottom: '0.75rem' }}>
                {isAr ? `نسبة التوافق: ${result?.score}%` : `Match score: ${result?.score}%`}
              </div>
              <p style={{ color: 'var(--text-body)', fontSize: '0.92rem', maxWidth: '480px', margin: '0 auto 1rem auto', lineHeight: 1.7 }}>
                {isAr
                  ? 'يرجى مراجعة الاشتراطات الفنية والتراخيص قبل رفع الطلب لتجنب طلبات التعديل أو التأخير. يمكنك إعادة الفحص بعد الاستيفاء.'
                  : 'Please verify licensing and technical conditions before submission. You can retake the assessment afterwards.'}
              </p>
              {!!result?.unmet.length && (
                <div style={{ textAlign: 'start', maxWidth: '480px', margin: '0 auto 1.25rem auto', background: 'var(--gov-crimson-light)', border: '1px solid var(--gov-crimson-border)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--gov-crimson)', marginBottom: '0.4rem' }}>
                    {isAr ? 'شروط غير مستوفاة:' : 'Unmet conditions:'}
                  </div>
                  <ul style={{ margin: 0, paddingInlineStart: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {result.unmet.map(q => (
                      <li key={q.key} style={{ fontSize: '0.84rem', color: 'var(--text-body)', lineHeight: 1.6 }}>
                        {(isAr ? q.questionAr : q.questionEn) || q.questionAr || q.questionEn}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer — confirm + result actions (was missing entirely) */}
      <div className="elig-footer">
        {!submitted ? (
          <>
            <span className="elig-progress">
              {questions.length === 0
                ? (isAr ? 'جاهز للمتابعة' : 'Ready to proceed')
                : (isAr ? `تمت الإجابة: ${answeredCount} / ${questions.length}` : `Answered: ${answeredCount} / ${questions.length}`)}
            </span>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <X size={15} />
              <span>{isAr ? 'إلغاء' : 'Cancel'}</span>
            </button>
            {questions.length === 0 ? (
              <button type="button" className="btn btn-primary" onClick={onProceedToApply}>
                <Building2 size={15} />
                <span>{isAr ? 'المتابعة للتقديم' : 'Proceed to Apply'}</span>
                {isAr ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!allAnswered}
                title={!allAnswered ? (isAr ? 'أجب على جميع الأسئلة أولاً' : 'Answer all questions first') : undefined}
                style={!allAnswered ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                onClick={() => setSubmitted(true)}
              >
                <CheckCircle2 size={15} />
                <span>{isAr ? 'تأكيد الفحص وعرض النتيجة' : 'Confirm & Show Result'}</span>
                {isAr ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              <RotateCcw size={15} />
              <span>{isAr ? 'إعادة الفحص' : 'Retake'}</span>
            </button>
            {result?.isEligible ? (
              <button type="button" className="btn btn-primary" onClick={onProceedToApply}>
                <Building2 size={15} />
                <span>{isAr ? 'المتابعة لتقديم الطلب' : 'Proceed to Apply'}</span>
                {isAr ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                <X size={15} />
                <span>{isAr ? 'إغلاق' : 'Close'}</span>
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
