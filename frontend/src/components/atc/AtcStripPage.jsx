import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Loader2, Map, Plus, Search, TowerControl } from 'lucide-react';

import * as api from '../../services/api';

import socketService from '../../services/socket';

import { useUser } from '../../contexts/UserContext';

import { t } from '../../utils/locale';

import airports from '../../config/airports';

import AtcStripBoard from './AtcStripBoard';

import AtcCoordinationPanel from './AtcCoordinationPanel';

import AtcHistoryPanel from './AtcHistoryPanel';

import AtcChartsPanel from './AtcChartsPanel';

import AtcRoleSlots from './AtcRoleSlots';

import { OWNER_ROLE, STRIP_DIRECTION, canEditStrip, resolveClaimedRole, defaultRunwayConfig, createEmptyForm } from './atcStripModel';

import { playHandoffAlert, primeHandoffAudio, shouldPlayHandoffAlert } from './atcHandoffSound';

import './AtcStripPage.css';



const BLUE_AIRPORTS = airports.filter((a) => !a.isHeliport || a.isMainBase);



const ERROR_KEYS = {

  ROLE_NOT_CLAIMED: 'atc.errors.roleNotClaimed',

  ROLE_OCCUPIED: 'atc.errors.roleOccupied',

  MUST_RELEASE_CURRENT_ROLE: 'atc.errors.mustReleaseFirst',

  STRIP_NOT_IN_YOUR_SECTOR: 'atc.errors.stripNotInSector',

  NOT_AUTHENTICATED: 'atc.errors.loginRequired',

};



function translateApiError(err) {

  const raw = err?.message || err?.error || '';

  if (raw === 'Not authenticated' || raw === 'NOT_AUTHENTICATED') {

    return t('atc.errors.loginRequired');

  }

  const key = ERROR_KEYS[raw] || ERROR_KEYS[err?.message] || ERROR_KEYS[err?.error];

  if (key) return t(key);

  return raw || String(err);

}



export default function AtcStripPage() {

  const { user, loading: userLoading } = useUser();

  const [airportId, setAirportId] = useState(BLUE_AIRPORTS[0]?.id || 'aleppo');

  const [strips, setStrips] = useState([]);

  const [nextActions, setNextActions] = useState({});

  const [history, setHistory] = useState([]);

  const [roleSlots, setRoleSlots] = useState({ GROUND: null, TOWER: null });

  const [tocQueue, setTocQueue] = useState([]);

  const [runwayConfig, setRunwayConfig] = useState(defaultRunwayConfig);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [selectedId, setSelectedId] = useState(null);

  const [inlineEditStripId, setInlineEditStripId] = useState(null);

  const [search, setSearch] = useState('');

  const [activeDragId, setActiveDragId] = useState(null);

  const [chartsOpen, setChartsOpen] = useState(false);

  const [chartsWidth, setChartsWidth] = useState(420);

  const stripsSnapshotRef = useRef([]);

  const handoffAlertReadyRef = useRef(false);

  const patchTimersRef = useRef({});



  const claimedRole = useMemo(

    () => resolveClaimedRole(roleSlots, user?.id),

    [roleSlots, user?.id],

  );



  const airport = useMemo(

    () => BLUE_AIRPORTS.find((a) => a.id === airportId) || BLUE_AIRPORTS[0],

    [airportId],

  );



  const applyBoardPayload = useCallback((payload) => {

    if (!payload) return;

    const nextStrips = payload.strips || [];

    stripsSnapshotRef.current = nextStrips;

    setStrips(nextStrips);

    setNextActions(payload.nextActions || {});

    setHistory(payload.recentHistory || []);

    setRoleSlots(payload.roleSlots || { GROUND: null, TOWER: null });

    setTocQueue(payload.tocQueue || []);

    if (payload.runwayConfig) setRunwayConfig({ ...defaultRunwayConfig(), ...payload.runwayConfig });

  }, []);



  const applyMutationResult = useCallback((result) => {

    if (result?.strips) applyBoardPayload(result);

  }, [applyBoardPayload]);



  const loadBoard = useCallback(async () => {

    try {

      setLoading(true);

      handoffAlertReadyRef.current = false;

      setError('');

      const payload = await api.getAtcBoard(airportId);

      applyBoardPayload(payload);

      stripsSnapshotRef.current = payload.strips || [];

    } catch (err) {

      setError(err.message || 'Failed to load ATC board');

    } finally {

      setLoading(false);

      handoffAlertReadyRef.current = true;

    }

  }, [airportId, applyBoardPayload]);



  useEffect(() => {

    loadBoard();

  }, [loadBoard]);



  useEffect(() => {

    const primeOnInteraction = () => primeHandoffAudio();

    window.addEventListener('pointerdown', primeOnInteraction, { once: true });

    return () => window.removeEventListener('pointerdown', primeOnInteraction);

  }, []);



  useEffect(() => {

    socketService.connect();

    const unsubscribe = socketService.on('atc:updated', (payload) => {

      if (payload?.airportId && payload.airportId !== airportId) return;

      const prevStrips = stripsSnapshotRef.current;

      const nextStrips = payload.strips || [];

      if (

        handoffAlertReadyRef.current

        && shouldPlayHandoffAlert(prevStrips, nextStrips, claimedRole, user?.id, payload.recentHistory)

      ) {

        playHandoffAlert();

      }

      stripsSnapshotRef.current = nextStrips;

      applyBoardPayload(payload);

    });

    return () => unsubscribe();

  }, [airportId, applyBoardPayload, claimedRole, user?.id]);



  const filteredStrips = useMemo(() => {

    if (!search.trim()) return strips;

    const q = search.trim().toLowerCase();

    return strips.filter((s) => String(s.callsign || '').toLowerCase().includes(q));

  }, [strips, search]);



  const selectedStrip = useMemo(

    () => strips.find((s) => s.id === selectedId) || null,

    [strips, selectedId],

  );



  const selectedEditable = useMemo(

    () => Boolean(selectedStrip && claimedRole && canEditStrip(selectedStrip, claimedRole)),

    [selectedStrip, claimedRole],

  );



  const showError = (err) => {

    setError(translateApiError(err));

    window.setTimeout(() => setError(''), 5000);

  };



  const requireClaimed = () => {

    if (userLoading) {

      return false;

    }

    if (!user) {

      showError(new Error(t('atc.errors.loginRequired')));

      return false;

    }

    if (!claimedRole) {

      showError(new Error(t('atc.errors.roleNotClaimed')));

      return false;

    }

    return true;

  };



  const handleClaimRole = async (role) => {

    if (userLoading) return;

    if (!user) return showError(new Error(t('atc.errors.loginRequired')));

    try {

      const payload = await api.claimAtcRole(airportId, role);

      applyBoardPayload(payload);

      setSelectedId(null);

    } catch (err) {

      showError(err);

    }

  };



  const handleReleaseRole = async (role) => {

    if (userLoading) return;

    if (!user) return showError(new Error(t('atc.errors.loginRequired')));

    try {

      const payload = await api.releaseAtcRole(airportId, role);

      applyBoardPayload(payload);

      setSelectedId(null);

    } catch (err) {

      showError(err);

    }

  };



  const handleFieldChange = useCallback((stripId, field, value) => {

    setStrips((prev) => {

      const next = prev.map((s) => (s.id === stripId ? { ...s, [field]: value } : s));

      stripsSnapshotRef.current = next;

      return next;

    });

  }, []);



  const handleFieldCommit = useCallback((stripId, field, value) => {

    if (!claimedRole || !user) return;

    const timerKey = `${stripId}:${field}`;

    clearTimeout(patchTimersRef.current[timerKey]);

    patchTimersRef.current[timerKey] = window.setTimeout(async () => {

      try {

        const result = await api.patchAtcStrip(stripId, {

          [field]: value,

          airportId,

          role: claimedRole,

        });

        applyMutationResult(result);

      } catch (err) {

        showError(err);

      }

    }, 300);

  }, [airportId, claimedRole, user, applyMutationResult]);



  const handleNewStrip = useCallback(async () => {

    if (!requireClaimed()) return;

    const direction = claimedRole === OWNER_ROLE.TOWER ? STRIP_DIRECTION.ARR : STRIP_DIRECTION.DEP;

    try {

      const result = await api.createAtcStrip({

        ...createEmptyForm(direction),

        direction,

        airportId,

        role: claimedRole,

      });

      applyMutationResult(result);

      if (result.strip?.id) setSelectedId(result.strip.id);

    } catch (err) {

      showError(err);

    }

  }, [airportId, claimedRole, applyMutationResult]);



  useEffect(() => {

    const onKey = (event) => {

      if (event.target?.tagName === 'INPUT' || event.target?.tagName === 'TEXTAREA') return;

      if ((event.key === 'n' || event.key === 'N') && claimedRole) {

        handleNewStrip();

      }

      if (event.key === '/') {

        event.preventDefault();

        document.getElementById('atc-search')?.focus();

      }

    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);

  }, [claimedRole, handleNewStrip]);



  const handleAction = async (strip, action) => {

    if (!requireClaimed()) return;

    try {

      const result = await api.moveAtcStrip(strip.id, { airportId, action, role: claimedRole });

      applyMutationResult(result);

      setSelectedId(strip.id);

    } catch (err) {

      showError(err);

    }

  };



  const handleMoveStrip = async (strip, bayId, { operationalState } = {}) => {

    if (!requireClaimed()) return;

    try {

      const result = await api.moveAtcStrip(strip.id, { airportId, bayId, role: claimedRole, operationalState });

      applyMutationResult(result);

    } catch (err) {

      showError(err);

    }

  };



  const handleRunwayConfigChange = async (patch) => {

    if (!requireClaimed()) return;

    setRunwayConfig((prev) => ({ ...prev, ...patch }));

    try {

      const payload = await api.setAtcRunwayConfig(airportId, { ...patch, role: claimedRole });

      applyBoardPayload(payload);

    } catch (err) {

      showError(err);

    }

  };



  const handleCancelHandoff = async (strip, targetBay) => {

    if (!requireClaimed()) return;

    try {

      const result = await api.cancelAtcHandoff(strip.id, { airportId, role: claimedRole, targetBay });

      applyMutationResult(result);

      setSelectedId(null);

    } catch (err) {

      showError(err);

    }

  };



  const handleCoordinate = async (strip, accept) => {

    if (!requireClaimed()) return;

    try {

      const result = await api.coordinateAtcStrip(strip.id, { airportId, accept, role: claimedRole });

      applyMutationResult(result);

    } catch (err) {

      showError(err);

    }

  };



  const handleDelete = async () => {

    if (!requireClaimed() || !selectedId) return;

    const strip = strips.find((s) => s.id === selectedId);

    if (!strip) return;

    if (!window.confirm(t('atc.confirmDelete', { callsign: strip.callsign }))) return;

    try {

      const result = await api.deleteAtcStrip(selectedId, airportId, claimedRole);

      applyMutationResult(result);

      setSelectedId(null);

    } catch (err) {

      showError(err);

    }

  };



  if (loading || userLoading) {

    return (

      <div className="atc-page atc-page--loading">

        <Loader2 className="w-8 h-8 animate-spin text-yt-accent" />

        <span>{t('atc.loading')}</span>

      </div>

    );

  }



  return (

    <div className="atc-page">

      <header className="atc-toolbar">

        <div className="atc-toolbar__left">

          <TowerControl className="w-5 h-5 text-yt-accent" />

          <div>

            <h1 className="atc-toolbar__title">{t('atc.title')}</h1>

            <p className="atc-toolbar__subtitle">{airport?.displayName || airport?.name} ({airport?.icao})</p>

          </div>

        </div>



        <div className="atc-toolbar__center">

          <label className="atc-toolbar__field atc-toolbar__field--airport">

            <span className="atc-toolbar__field-label">{t('atc.fields.airport')}</span>

            <select
              className="atc-toolbar__select"
              value={airportId}
              onChange={(e) => setAirportId(e.target.value)}
            >

              {BLUE_AIRPORTS.map((a) => (

                <option key={a.id} value={a.id}>{a.displayName || a.name}</option>

              ))}

            </select>

          </label>

          <AtcRoleSlots

            roleSlots={roleSlots}

            userId={user?.id}

            claimedRole={claimedRole}

            onClaim={handleClaimRole}

            onRelease={handleReleaseRole}

            compact

          />

        </div>



        <div className="atc-toolbar__right">

          <div className="atc-search">

            <Search className="w-4 h-4" />

            <input

              id="atc-search"

              value={search}

              onChange={(e) => setSearch(e.target.value)}

              placeholder={t('atc.searchPlaceholder')}

            />

          </div>

          <button

            type="button"

            className={`atc-toolbar__btn ${chartsOpen ? 'atc-toolbar__btn--active' : ''}`}

            onClick={() => setChartsOpen((open) => !open)}

          >

            <Map className="w-4 h-4" />

            {t('atc.charts.toggle')}

          </button>

          {claimedRole && (

            <>

              <button

                type="button"

                className="atc-toolbar__btn atc-toolbar__btn--primary"

                onClick={handleNewStrip}

              >

                <Plus className="w-4 h-4" />

                {t('atc.newStrip')}

              </button>

              {selectedEditable && (

                <button type="button" className="atc-toolbar__btn atc-toolbar__btn--danger" onClick={handleDelete}>

                  {t('atc.deleteStrip')}

                </button>

              )}

            </>

          )}

        </div>

      </header>



      {error && <div className="atc-banner atc-banner--error">{error}</div>}

      {!claimedRole && (

        <div className="atc-banner atc-banner--warn">{t('atc.errors.claimToOperate')}</div>

      )}



      {claimedRole && (

        <AtcCoordinationPanel

          strips={strips}

          tocQueue={tocQueue}

          operatorRole={claimedRole}

          onAccept={(strip) => handleCoordinate(strip, true)}

          onReject={(strip) => handleCoordinate(strip, false)}

        />

      )}



      <div className="atc-workspace">

        <div className="atc-main">

          <div className="atc-board-wrap">

          {claimedRole ? (

            <AtcStripBoard

              strips={filteredStrips}

              operatorRole={claimedRole}

              selectedId={selectedId}

              nextActions={nextActions}

              runwayConfig={runwayConfig}

              onSelect={(strip) => setSelectedId(strip.id)}

              onFieldChange={handleFieldChange}

              onFieldCommit={handleFieldCommit}

              onInlineEditFocus={setInlineEditStripId}

              onInlineEditBlur={() => setInlineEditStripId(null)}

              inlineEditStripId={inlineEditStripId}

              onAction={handleAction}

              onCoordinate={handleCoordinate}

              onCancelHandoff={handleCancelHandoff}

              onMoveStrip={handleMoveStrip}

              onRunwayConfigChange={handleRunwayConfigChange}

              activeDragId={activeDragId}

              setActiveDragId={setActiveDragId}

              readOnly={!claimedRole}

            />

          ) : (

            <div className="atc-board-placeholder">{t('atc.slots.selectPosition')}</div>

          )}

          </div>

        </div>



        {chartsOpen && (

          <AtcChartsPanel

            airportId={airportId}

            width={chartsWidth}

            onWidthChange={setChartsWidth}

            onClose={() => setChartsOpen(false)}

          />

        )}

        <aside className="atc-history-side">

          <AtcHistoryPanel entries={history} filterCallsign={search} />

        </aside>

      </div>

    </div>

  );

}


