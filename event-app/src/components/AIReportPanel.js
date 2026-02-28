import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  Brain, RefreshCw, ThumbsUp, ThumbsDown, Lightbulb,
  TrendingUp, Hash, Clock, AlertCircle,
} from 'lucide-react';

export default function AIReportPanel({ eventId, eventEnded }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState(false);

  const fetchExisting = useCallback(async () => {
    const { data } = await supabase
      .from('ai_event_reports')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();
    if (data) setReport(data);
    setFetched(true);
  }, [eventId]);

  useEffect(() => { fetchExisting(); }, [fetchExisting]);

  const generate = async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        'analyze-event-feedback',
        { body: { event_id: eventId } }
      );

      if (fnErr) {
        setError(fnErr.message || 'Failed to generate report');
      } else if (data?.error) {
        setError(data.error);
      } else {
        setReport(data);
      }
    } catch (e) {
      setError(e.message || 'Network error');
    }

    setLoading(false);
  };

  const sentimentColor = (score) => {
    if (score >= 70) return '#22c55e';
    if (score >= 40) return '#eab308';
    return '#ef4444';
  };

  const sentimentLabel = (score) => {
    if (score >= 80) return 'Very Positive';
    if (score >= 60) return 'Positive';
    if (score >= 40) return 'Neutral';
    if (score >= 20) return 'Negative';
    return 'Very Negative';
  };

  if (!fetched) return null;

  if (!report && !eventEnded) {
    return (
      <div className="ai-report-section">
        <div className="ai-report-locked">
          <Clock size={18} />
          <span>AI Report available after event ends</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-report-section">
      <div className="ai-report-header">
        <div className="ai-report-header-left">
          <Brain size={18} className="ai-report-brain" />
          <span className="ai-report-title">AI Feedback Report</span>
        </div>
        <button
          className="ai-report-gen-btn"
          onClick={generate}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'ai-spin' : ''} />
          {loading ? 'Analyzing...' : report ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {error && (
        <div className="ai-report-error">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {report && (
        <div className="ai-report-body">
          {/* Sentiment gauge */}
          <div className="ai-sentiment-card">
            <div className="ai-sentiment-ring" style={{ '--score': report.sentiment_score, '--color': sentimentColor(report.sentiment_score) }}>
              <svg viewBox="0 0 100 100" className="ai-sentiment-svg">
                <circle cx="50" cy="50" r="42" className="ai-ring-bg" />
                <circle cx="50" cy="50" r="42" className="ai-ring-fill"
                  strokeDasharray={`${(report.sentiment_score / 100) * 264} 264`}
                />
              </svg>
              <div className="ai-sentiment-score">{report.sentiment_score}</div>
            </div>
            <div className="ai-sentiment-info">
              <span className="ai-sentiment-label" style={{ color: sentimentColor(report.sentiment_score) }}>
                {sentimentLabel(report.sentiment_score)}
              </span>
              <span className="ai-sentiment-sub">{report.message_count} messages analyzed</span>
            </div>
          </div>

          {/* Summaries */}
          {report.expectations_summary && (
            <div className="ai-summary-card">
              <h5 className="ai-summary-title"><TrendingUp size={14} /> Expectations</h5>
              <p>{report.expectations_summary}</p>
            </div>
          )}
          {report.feedback_summary && (
            <div className="ai-summary-card">
              <h5 className="ai-summary-title"><TrendingUp size={14} /> Feedback</h5>
              <p>{report.feedback_summary}</p>
            </div>
          )}

          {/* Positives */}
          {report.positives?.length > 0 && (
            <div className="ai-list-card ai-list-card--pos">
              <h5 className="ai-list-title"><ThumbsUp size={14} /> Positives</h5>
              <ul>
                {report.positives.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          )}

          {/* Negatives */}
          {report.negatives?.length > 0 && (
            <div className="ai-list-card ai-list-card--neg">
              <h5 className="ai-list-title"><ThumbsDown size={14} /> Negatives</h5>
              <ul>
                {report.negatives.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {report.suggestions?.length > 0 && (
            <div className="ai-list-card ai-list-card--sug">
              <h5 className="ai-list-title"><Lightbulb size={14} /> Suggestions</h5>
              <ul>
                {report.suggestions.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          )}

          {/* Top topics */}
          {report.top_topics?.length > 0 && (
            <div className="ai-topics-card">
              <h5 className="ai-topics-title"><Hash size={14} /> Top Topics</h5>
              <div className="ai-topics-list">
                {report.top_topics.map((t, i) => (
                  <span className="ai-topic-pill" key={i}>
                    {t.topic} <span className="ai-topic-count">{t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {report.generated_at && (
            <div className="ai-report-footer">
              Generated {new Date(report.generated_at).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
