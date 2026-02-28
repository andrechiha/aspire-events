import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import FormSection from '../../components/FormSection';
import LabeledInput from '../../components/LabeledInput';
import DateTimePill from '../../components/DateTimePill';
import WavesEditor from '../../components/WavesEditor';
import { Upload, Image, Film, X, PlusCircle, Trash2 } from 'lucide-react';
import './manager.css';

function addHours(iso, h) {
  const d = new Date(iso);
  d.setHours(d.getHours() + h);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateEvent() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const logoRef = useRef(null);
  const mediaRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [touched, setTouched] = useState({});

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDt, setStartDt] = useState('');
  const [endDt, setEndDt] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationLink, setLocationLink] = useState('');

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);

  const [waves, setWaves] = useState([{ label: 'Early Bird', price: '', capacity: '' }]);

  const [rules, setRules] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [chatDescription, setChatDescription] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [promoterName, setPromoterName] = useState('');
  const [promoterLogoUrl, setPromoterLogoUrl] = useState('');
  const [promoterInstagram, setPromoterInstagram] = useState('');
  const [lineup, setLineup] = useState([]);
  const promoterLogoRef = useRef(null);

  const addArtist = () => {
    setLineup((prev) => [...prev, { name: '', photo_url: '', spotify_url: '', youtube_url: '', soundcloud_url: '', instagram_url: '', _photoFile: null }]);
  };

  const updateArtist = (idx, field, value) => {
    setLineup((prev) => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const removeArtist = (idx) => {
    setLineup((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleArtistPhoto = (idx, e) => {
    const file = e.target.files[0];
    if (!file) return;
    updateArtist(idx, '_photoFile', file);
    updateArtist(idx, 'photo_url', URL.createObjectURL(file));
  };

  const handlePromoterLogoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPromoterLogoUrl(URL.createObjectURL(file));
    promoterLogoRef.current._file = file;
  };

  // ── Validation ──
  const errors = useMemo(() => {
    const e = {};
    if (touched.title && !title.trim()) e.title = 'Title is required';
    if (touched.startDt && !startDt) e.startDt = 'Start date is required';
    if (touched.endDt && !endDt) e.endDt = 'End date is required';
    if (startDt && endDt && endDt <= startDt) e.endDt = 'End time must be after start time';
    if (touched.locationName && !locationName.trim()) e.locationName = 'Location name is required';
    return e;
  }, [title, startDt, endDt, locationName, touched]);

  const waveErrors = useMemo(() => {
    if (!touched.waves) return {};
    const errs = {};
    waves.forEach((w, i) => {
      if (!w.label.trim() || !w.price || !w.capacity || parseInt(w.capacity, 10) < 1 || parseFloat(w.price) < 0) {
        errs[i] = true;
      }
    });
    return errs;
  }, [waves, touched]);

  const canSubmit = useMemo(() => {
    if (!title.trim() || !startDt || !endDt || endDt <= startDt || !locationName.trim()) return false;
    const badWave = waves.find(
      (w) => !w.label.trim() || !w.price || !w.capacity || parseInt(w.capacity, 10) < 1
    );
    if (badWave || waves.length === 0) return false;
    return true;
  }, [title, startDt, endDt, locationName, waves]);

  // ── Handlers ──
  const touch = (field) => setTouched((t) => ({ ...t, [field]: true }));

  const handleStartChange = (val) => {
    setStartDt(val);
    touch('startDt');
    if (!endDt || endDt <= val) {
      setEndDt(addHours(val, 2));
      touch('endDt');
    }
  };

  const handleEndChange = (val) => {
    touch('endDt');
    if (startDt && val <= startDt) {
      setEndDt(addHours(startDt, 0.5));
    } else {
      setEndDt(val);
    }
  };

  const handleLogoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files);
    const combined = [...mediaFiles, ...files].slice(0, 10);
    setMediaFiles(combined);
    setMediaPreviews(combined.map((f) => ({ url: URL.createObjectURL(f), type: f.type })));
  };

  const removeMedia = (idx) => {
    const next = mediaFiles.filter((_, i) => i !== idx);
    setMediaFiles(next);
    setMediaPreviews(next.map((f) => ({ url: URL.createObjectURL(f), type: f.type })));
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ title: true, startDt: true, endDt: true, locationName: true, waves: true });
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      let logoUrl = null;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `logos/${profile.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('event-media').upload(path, logoFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('event-media').getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      }

      let promoterLogo = promoterLogoUrl;
      if (promoterLogoRef.current?._file) {
        const pFile = promoterLogoRef.current._file;
        const ext = pFile.name.split('.').pop();
        const path = `promoters/${profile.id}/${Date.now()}.${ext}`;
        const { error: pUpErr } = await supabase.storage.from('event-media').upload(path, pFile);
        if (!pUpErr) {
          const { data: pUrlData } = supabase.storage.from('event-media').getPublicUrl(path);
          promoterLogo = pUrlData.publicUrl;
        }
      }

      const lineupData = [];
      for (const artist of lineup) {
        let photoUrl = artist.photo_url || '';
        if (artist._photoFile) {
          const ext = artist._photoFile.name.split('.').pop();
          const path = `artists/${profile.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: aUpErr } = await supabase.storage.from('event-media').upload(path, artist._photoFile);
          if (!aUpErr) {
            const { data: aUrlData } = supabase.storage.from('event-media').getPublicUrl(path);
            photoUrl = aUrlData.publicUrl;
          }
        }
        lineupData.push({
          name: artist.name.trim(),
          photo_url: photoUrl,
          spotify_url: artist.spotify_url.trim() || null,
          youtube_url: artist.youtube_url.trim() || null,
          soundcloud_url: artist.soundcloud_url.trim() || null,
          instagram_url: artist.instagram_url.trim() || null,
        });
      }

      const { data: eventData, error: insertErr } = await supabase
        .from('events')
        .insert({
          created_by: profile.id,
          title: title.trim(),
          description: description.trim() || null,
          rules: rules.trim() || null,
          start_datetime: startDt,
          end_datetime: endDt,
          location_name: locationName.trim(),
          location_address: locationAddress.trim() || null,
          location_link: locationLink.trim() || null,
          logo_url: logoUrl,
          promoter_name: promoterName.trim() || null,
          promoter_logo_url: promoterLogo && !promoterLogo.startsWith('blob:') ? promoterLogo : null,
          promoter_instagram: promoterInstagram.trim() || null,
          lineup: lineupData.length > 0 ? lineupData : [],
          chat_enabled: chatEnabled,
          chat_description: chatEnabled ? (chatDescription.trim() || null) : null,
          status: 'pending',
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      const eventId = eventData.id;

      const waveRows = waves.map((w, i) => ({
        event_id: eventId,
        wave_number: i + 1,
        label: w.label.trim(),
        price: parseFloat(w.price),
        capacity: parseInt(w.capacity, 10),
        remaining: parseInt(w.capacity, 10),
        is_active: i === 0,
      }));
      const { error: wavesErr } = await supabase.from('ticket_waves').insert(waveRows);
      if (wavesErr) throw wavesErr;

      if (chatEnabled) {
        await supabase.from('event_attendees').upsert({
          event_id: eventId,
          user_id: profile.id,
        }, { onConflict: 'event_id,user_id' });
      }

      for (const file of mediaFiles) {
        const ext = file.name.split('.').pop();
        const path = `events/${eventId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: mUpErr } = await supabase.storage.from('event-media').upload(path, file);
        if (mUpErr) throw mUpErr;
        const mediaType = file.type.startsWith('video') ? 'video' : 'image';
        const { data: mUrlData } = supabase.storage.from('event-media').getPublicUrl(path);
        await supabase.from('event_media').insert({
          event_id: eventId,
          media_type: mediaType,
          storage_path: mUrlData.publicUrl,
        });
      }

      navigate('/');
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ce-page">
      <div className="page-header">
        <h1>Create Event</h1>
        <p>Submit a new event for approval</p>
      </div>

      <form className="ce-form" onSubmit={handleSubmit} noValidate>
        {submitError && <div className="ce-toast ce-toast--error">{submitError}</div>}

        {/* ── Section 1: Basic Info ── */}
        <FormSection icon="📝" title="Basic Info" subtitle="Name and describe your event">
          <LabeledInput
            label="Event Title"
            placeholder="Summer Music Festival 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => touch('title')}
            error={errors.title}
          />
          <LabeledInput
            label="Description"
            placeholder="Tell people what to expect..."
            textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormSection>

        {/* ── Section 2: Logo ── */}
        <FormSection icon="🎨" title="Event Logo" subtitle="Upload a logo or cover image">
          <div className="ce-logo-zone" onClick={() => logoRef.current?.click()}>
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="ce-logo-img" />
            ) : (
              <div className="ce-logo-empty">
                <Upload size={28} />
                <span>Click to upload</span>
                <span className="ce-logo-hint">PNG, JPG up to 5 MB</span>
              </div>
            )}
          </div>
          <input ref={logoRef} type="file" accept="image/*" hidden onChange={handleLogoSelect} />
        </FormSection>

        {/* ── Section 3: Schedule ── */}
        <FormSection icon="📅" title="Schedule" subtitle="When does the event start and end?">
          <div className="ce-dt-row">
            <DateTimePill
              label="Start"
              value={startDt}
              onChange={handleStartChange}
              min={nowLocal()}
              error={errors.startDt}
            />
            <DateTimePill
              label="End"
              value={endDt}
              onChange={handleEndChange}
              min={startDt || nowLocal()}
              error={errors.endDt}
            />
          </div>
        </FormSection>

        {/* ── Section 4: Location ── */}
        <FormSection icon="📍" title="Location" subtitle="Where is the event?">
          <LabeledInput
            label="Venue / Location Name"
            placeholder="IF Performance Hall Beşiktaş"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            onBlur={() => touch('locationName')}
            error={errors.locationName}
          />
          <LabeledInput
            label="Address"
            placeholder="Cihannüma Mahallesi, Hasfırın Cd. No:26, 34353"
            value={locationAddress}
            onChange={(e) => setLocationAddress(e.target.value)}
          />
          <LabeledInput
            label="Location Link (Maps)"
            placeholder="https://maps.google.com/..."
            value={locationLink}
            onChange={(e) => setLocationLink(e.target.value)}
          />
        </FormSection>

        {/* ── Section 4b: Rules ── */}
        <FormSection icon="📋" title="Rules" subtitle="Event rules and restrictions (optional)">
          <LabeledInput
            label="Rules"
            placeholder="The event is for participants aged 18 and over.&#10;It is forbidden to bring food and drink, sharp, piercing or flammable tools into the event area."
            textarea
            rows={4}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
          />
        </FormSection>

        {/* ── Section 4b2: Group Chat ── */}
        <FormSection icon="💬" title="Group Chat" subtitle="Create a chat for attendees to connect">
          <div className="ce-toggle-row">
            <label className="ce-toggle-label">
              <span>Enable Group Chat</span>
              <button
                type="button"
                className={`ce-toggle ${chatEnabled ? 'ce-toggle--on' : ''}`}
                onClick={() => setChatEnabled(!chatEnabled)}
              >
                <span className="ce-toggle-knob" />
              </button>
            </label>
            <p className="ce-toggle-hint">Recommended — enables automatic AI feedback analysis and attendee expectations tracking</p>
          </div>
          {chatEnabled && (
            <LabeledInput
              label="Chat Description"
              placeholder="Welcome! Use this chat to connect with other attendees..."
              textarea
              rows={2}
              value={chatDescription}
              onChange={(e) => setChatDescription(e.target.value)}
            />
          )}
        </FormSection>

        {/* ── Section 4c: Promoter ── */}
        <FormSection icon="🏢" title="Promoter" subtitle="Who is promoting this event? (optional)">
          <LabeledInput
            label="Promoter Name"
            placeholder="Blind Events"
            value={promoterName}
            onChange={(e) => setPromoterName(e.target.value)}
          />
          <div className="labeled-input" style={{ marginBottom: 14 }}>
            <label className="labeled-input__label">Promoter Logo</label>
            <div className="ce-promoter-logo-zone" onClick={() => promoterLogoRef.current?.click()}>
              {promoterLogoUrl ? (
                <img src={promoterLogoUrl} alt="" className="ce-promoter-logo-img" />
              ) : (
                <div className="ce-promoter-logo-empty">
                  <Upload size={20} />
                  <span>Upload logo</span>
                </div>
              )}
            </div>
            <input ref={promoterLogoRef} type="file" accept="image/*" hidden onChange={handlePromoterLogoSelect} />
          </div>
          <LabeledInput
            label="Promoter Instagram"
            placeholder="@blindevents or full URL"
            value={promoterInstagram}
            onChange={(e) => setPromoterInstagram(e.target.value)}
          />
        </FormSection>

        {/* ── Section 4d: Line-Up ── */}
        <FormSection icon="🎤" title="Line-Up" subtitle="Add DJs, artists, or performers (optional)">
          {lineup.map((artist, idx) => (
            <div className="ce-artist-card" key={idx}>
              <div className="ce-artist-header">
                <div className="ce-artist-photo-zone" onClick={() => {
                  const input = document.getElementById(`artist-photo-${idx}`);
                  if (input) input.click();
                }}>
                  {artist.photo_url ? (
                    <img src={artist.photo_url} alt="" className="ce-artist-photo-img" />
                  ) : (
                    <div className="ce-artist-photo-empty">
                      <Upload size={14} />
                    </div>
                  )}
                </div>
                <input id={`artist-photo-${idx}`} type="file" accept="image/*" hidden onChange={(e) => handleArtistPhoto(idx, e)} />
                <div className="ce-artist-name-wrap">
                  <input
                    className="we-input"
                    placeholder="Artist / DJ name"
                    value={artist.name}
                    onChange={(e) => updateArtist(idx, 'name', e.target.value)}
                  />
                </div>
                <button type="button" className="we-remove" onClick={() => removeArtist(idx)}>
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="ce-artist-links">
                <div className="ce-artist-link-row">
                  <span className="ce-artist-link-icon" title="Spotify">🟢</span>
                  <input className="we-input" placeholder="Spotify URL" value={artist.spotify_url} onChange={(e) => updateArtist(idx, 'spotify_url', e.target.value)} />
                </div>
                <div className="ce-artist-link-row">
                  <span className="ce-artist-link-icon" title="YouTube">🔴</span>
                  <input className="we-input" placeholder="YouTube URL" value={artist.youtube_url} onChange={(e) => updateArtist(idx, 'youtube_url', e.target.value)} />
                </div>
                <div className="ce-artist-link-row">
                  <span className="ce-artist-link-icon" title="SoundCloud">🟠</span>
                  <input className="we-input" placeholder="SoundCloud URL" value={artist.soundcloud_url} onChange={(e) => updateArtist(idx, 'soundcloud_url', e.target.value)} />
                </div>
                <div className="ce-artist-link-row">
                  <span className="ce-artist-link-icon" title="Instagram">🟣</span>
                  <input className="we-input" placeholder="Instagram URL" value={artist.instagram_url} onChange={(e) => updateArtist(idx, 'instagram_url', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="waves-editor__add" onClick={addArtist}>
            <PlusCircle size={16} /> Add Artist
          </button>
        </FormSection>

        {/* ── Section 5: Media ── */}
        <FormSection icon="📸" title="Photos & Videos" subtitle="Up to 10 files to showcase your event">
          <div className="ce-media-grid">
            {mediaPreviews.map((m, i) => (
              <div className="ce-media-thumb" key={i}>
                {m.type.startsWith('video') ? (
                  <div className="ce-media-vid"><Film size={22} /></div>
                ) : (
                  <img src={m.url} alt="" />
                )}
                <button type="button" className="ce-media-rm" onClick={() => removeMedia(i)}>
                  <X size={12} />
                </button>
              </div>
            ))}
            {mediaFiles.length < 10 && (
              <div className="ce-media-add" onClick={() => mediaRef.current?.click()}>
                <Image size={20} />
                <span>Add</span>
              </div>
            )}
          </div>
          <input ref={mediaRef} type="file" accept="image/*,video/*" multiple hidden onChange={handleMediaSelect} />
        </FormSection>

        {/* ── Section 6: Ticket Waves ── */}
        <FormSection icon="🎟️" title="Ticket Waves" subtitle="Define pricing tiers — waves auto-advance when sold out">
          <WavesEditor
            waves={waves}
            onChange={(w) => { setWaves(w); touch('waves'); }}
            errors={waveErrors}
          />
        </FormSection>

        {/* ── Sticky Submit ── */}
        <div className="ce-submit-bar">
          <button
            className={`ce-submit-btn ${!canSubmit ? 'ce-submit-btn--disabled' : ''}`}
            type="submit"
            disabled={submitting || !canSubmit}
          >
            {submitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>
      </form>
    </div>
  );
}
