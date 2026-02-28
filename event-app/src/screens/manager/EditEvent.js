import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import FormSection from '../../components/FormSection';
import LabeledInput from '../../components/LabeledInput';
import DateTimePill from '../../components/DateTimePill';
import WavesEditor from '../../components/WavesEditor';
import { Upload, Image, Film, X, ArrowLeft, PlusCircle, Trash2 } from 'lucide-react';
import './manager.css';

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

export default function EditEvent() {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const logoRef = useRef(null);
  const mediaRef = useRef(null);

  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [touched, setTouched] = useState({});

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDt, setStartDt] = useState('');
  const [endDt, setEndDt] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationLink, setLocationLink] = useState('');
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null);

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const [existingMedia, setExistingMedia] = useState([]);
  const [removedMediaIds, setRemovedMediaIds] = useState([]);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);

  const [waves, setWaves] = useState([]);
  const [initialWaveIds, setInitialWaveIds] = useState([]);

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

  useEffect(() => {
    async function load() {
      const { data: ev, error: evErr } = await supabase
        .from('events')
        .select('*, ticket_waves(*), event_media(*)')
        .eq('id', id)
        .single();

      if (evErr || !ev) {
        setSubmitError('Event not found');
        setPageLoading(false);
        return;
      }

      setTitle(ev.title || '');
      setDescription(ev.description || '');
      setRules(ev.rules || '');
      setChatEnabled(ev.chat_enabled !== false);
      setChatDescription(ev.chat_description || '');
      setStartDt(toLocalInput(ev.start_datetime));
      setEndDt(toLocalInput(ev.end_datetime));
      setLocationName(ev.location_name || '');
      setLocationAddress(ev.location_address || '');
      setLocationLink(ev.location_link || '');
      setCurrentLogoUrl(ev.logo_url);
      setLogoPreview(ev.logo_url);
      setExistingMedia(ev.event_media || []);
      setPromoterName(ev.promoter_name || '');
      setPromoterLogoUrl(ev.promoter_logo_url || '');
      setPromoterInstagram(ev.promoter_instagram || '');
      setLineup((ev.lineup || []).map((a) => ({ ...a, _photoFile: null })));

      const sorted = [...(ev.ticket_waves || [])].sort((a, b) => a.wave_number - b.wave_number);
      setWaves(
        sorted.map((w) => ({
          id: w.id,
          wave_number: w.wave_number,
          label: w.label,
          price: String(w.price),
          capacity: String(w.capacity),
          _origCap: w.capacity,
          remaining: w.remaining,
          is_active: w.is_active,
        }))
      );
      setInitialWaveIds(sorted.map((w) => w.id));
      setPageLoading(false);
    }
    load();
  }, [id]);

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
      if (!w.label.trim() || !w.price || !w.capacity || parseInt(w.capacity, 10) < 1 || parseFloat(w.price) < 0)
        errs[i] = true;
    });
    return errs;
  }, [waves, touched]);

  const canSubmit = useMemo(() => {
    if (!title.trim() || !startDt || !endDt || endDt <= startDt || !locationName.trim()) return false;
    if (
      waves.length === 0 ||
      waves.find((w) => !w.label.trim() || !w.price || !w.capacity || parseInt(w.capacity, 10) < 1)
    )
      return false;
    return true;
  }, [title, startDt, endDt, locationName, waves]);

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
    if (startDt && val <= startDt) setEndDt(addHours(startDt, 0.5));
    else setEndDt(val);
  };

  const handleLogoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const visibleExisting = existingMedia.filter((m) => !removedMediaIds.includes(m.id));
  const totalMedia = visibleExisting.length + mediaFiles.length;

  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files);
    const allowed = files.slice(0, Math.max(0, 10 - totalMedia));
    const combined = [...mediaFiles, ...allowed];
    setMediaFiles(combined);
    setMediaPreviews(combined.map((f) => ({ url: URL.createObjectURL(f), type: f.type })));
  };

  const removeNewMedia = (idx) => {
    const next = mediaFiles.filter((_, i) => i !== idx);
    setMediaFiles(next);
    setMediaPreviews(next.map((f) => ({ url: URL.createObjectURL(f), type: f.type })));
  };

  const removeExistingMedia = (mediaId) => {
    setRemovedMediaIds((prev) => [...prev, mediaId]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ title: true, startDt: true, endDt: true, locationName: true, waves: true });
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      let logoUrl = currentLogoUrl;
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
          photo_url: photoUrl && !photoUrl.startsWith('blob:') ? photoUrl : (artist.photo_url && !artist.photo_url.startsWith('blob:') ? artist.photo_url : null),
          spotify_url: artist.spotify_url?.trim() || null,
          youtube_url: artist.youtube_url?.trim() || null,
          soundcloud_url: artist.soundcloud_url?.trim() || null,
          instagram_url: artist.instagram_url?.trim() || null,
        });
      }

      const { error: updateErr } = await supabase
        .from('events')
        .update({
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
        })
        .eq('id', id);
      if (updateErr) throw updateErr;

      const currentIds = waves.filter((w) => w.id).map((w) => w.id);
      const deletedIds = initialWaveIds.filter((wid) => !currentIds.includes(wid));

      if (deletedIds.length > 0) {
        const { error } = await supabase.from('ticket_waves').delete().in('id', deletedIds);
        if (error) throw error;
      }

      for (const w of waves.filter((w) => w.id)) {
        const newCap = parseInt(w.capacity, 10);
        const capDiff = newCap - (w._origCap || newCap);
        const newRemaining = Math.max(0, Math.min(newCap, (w.remaining ?? newCap) + capDiff));
        const { error } = await supabase
          .from('ticket_waves')
          .update({ label: w.label.trim(), price: parseFloat(w.price), capacity: newCap, remaining: newRemaining })
          .eq('id', w.id);
        if (error) throw error;
      }

      const maxWN = waves.filter((w) => w.id).reduce((m, w) => Math.max(m, w.wave_number || 0), 0);
      const hasActive = waves.some((w) => w.id && w.is_active);
      const newWaves = waves.filter((w) => !w.id).map((w, i) => ({
        event_id: id,
        wave_number: maxWN + i + 1,
        label: w.label.trim(),
        price: parseFloat(w.price),
        capacity: parseInt(w.capacity, 10),
        remaining: parseInt(w.capacity, 10),
        is_active: !hasActive && i === 0,
      }));
      if (newWaves.length > 0) {
        const { error } = await supabase.from('ticket_waves').insert(newWaves);
        if (error) throw error;
      }

      if (removedMediaIds.length > 0) {
        const { error } = await supabase.from('event_media').delete().in('id', removedMediaIds);
        if (error) throw error;
      }

      for (const file of mediaFiles) {
        const ext = file.name.split('.').pop();
        const path = `events/${id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: mUpErr } = await supabase.storage.from('event-media').upload(path, file);
        if (mUpErr) throw mUpErr;
        const mediaType = file.type.startsWith('video') ? 'video' : 'image';
        const { data: mUrlData } = supabase.storage.from('event-media').getPublicUrl(path);
        await supabase.from('event_media').insert({
          event_id: id,
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

  if (pageLoading) {
    return (
      <div className="empty-state">
        <p>Loading event...</p>
      </div>
    );
  }

  return (
    <div className="ce-page">
      <button type="button" className="ee-back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={18} /> Back to My Events
      </button>

      <div className="page-header">
        <h1>Edit Event</h1>
        <p>Update your event details</p>
      </div>

      <form className="ce-form" onSubmit={handleSubmit} noValidate>
        {submitError && <div className="ce-toast ce-toast--error">{submitError}</div>}

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

        <FormSection icon="📋" title="Rules" subtitle="Event rules and restrictions (optional)">
          <LabeledInput
            label="Rules"
            placeholder="The event is for participants aged 18 and over.&#10;It is forbidden to bring food and drink, sharp objects into the event area."
            textarea
            rows={4}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
          />
        </FormSection>

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

        <FormSection icon="🎤" title="Line-Up" subtitle="Add DJs, artists, or performers (optional)">
          {lineup.map((artist, idx) => (
            <div className="ce-artist-card" key={idx}>
              <div className="ce-artist-header">
                <div className="ce-artist-photo-zone" onClick={() => {
                  const input = document.getElementById(`edit-artist-photo-${idx}`);
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
                <input id={`edit-artist-photo-${idx}`} type="file" accept="image/*" hidden onChange={(e) => handleArtistPhoto(idx, e)} />
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
                  <input className="we-input" placeholder="Spotify URL" value={artist.spotify_url || ''} onChange={(e) => updateArtist(idx, 'spotify_url', e.target.value)} />
                </div>
                <div className="ce-artist-link-row">
                  <span className="ce-artist-link-icon" title="YouTube">🔴</span>
                  <input className="we-input" placeholder="YouTube URL" value={artist.youtube_url || ''} onChange={(e) => updateArtist(idx, 'youtube_url', e.target.value)} />
                </div>
                <div className="ce-artist-link-row">
                  <span className="ce-artist-link-icon" title="SoundCloud">🟠</span>
                  <input className="we-input" placeholder="SoundCloud URL" value={artist.soundcloud_url || ''} onChange={(e) => updateArtist(idx, 'soundcloud_url', e.target.value)} />
                </div>
                <div className="ce-artist-link-row">
                  <span className="ce-artist-link-icon" title="Instagram">🟣</span>
                  <input className="we-input" placeholder="Instagram URL" value={artist.instagram_url || ''} onChange={(e) => updateArtist(idx, 'instagram_url', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="waves-editor__add" onClick={addArtist}>
            <PlusCircle size={16} /> Add Artist
          </button>
        </FormSection>

        <FormSection icon="📸" title="Photos & Videos" subtitle="Up to 10 files to showcase your event">
          <div className="ce-media-grid">
            {visibleExisting.map((m) => (
              <div className="ce-media-thumb" key={m.id}>
                {m.media_type === 'video' ? (
                  <div className="ce-media-vid"><Film size={22} /></div>
                ) : (
                  <img src={m.storage_path} alt="" />
                )}
                <button type="button" className="ce-media-rm" onClick={() => removeExistingMedia(m.id)}>
                  <X size={12} />
                </button>
              </div>
            ))}
            {mediaPreviews.map((m, i) => (
              <div className="ce-media-thumb" key={`new-${i}`}>
                {m.type.startsWith('video') ? (
                  <div className="ce-media-vid"><Film size={22} /></div>
                ) : (
                  <img src={m.url} alt="" />
                )}
                <button type="button" className="ce-media-rm" onClick={() => removeNewMedia(i)}>
                  <X size={12} />
                </button>
              </div>
            ))}
            {totalMedia < 10 && (
              <div className="ce-media-add" onClick={() => mediaRef.current?.click()}>
                <Image size={20} />
                <span>Add</span>
              </div>
            )}
          </div>
          <input ref={mediaRef} type="file" accept="image/*,video/*" multiple hidden onChange={handleMediaSelect} />
        </FormSection>

        <FormSection icon="🎟️" title="Ticket Waves" subtitle="Edit pricing tiers — waves auto-advance when sold out">
          <WavesEditor
            waves={waves}
            onChange={(w) => { setWaves(w); touch('waves'); }}
            errors={waveErrors}
          />
        </FormSection>

        <div className="ce-submit-bar">
          <button
            className={`ce-submit-btn ${!canSubmit ? 'ce-submit-btn--disabled' : ''}`}
            type="submit"
            disabled={submitting || !canSubmit}
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
