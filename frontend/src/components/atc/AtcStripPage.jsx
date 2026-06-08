import { useCallback, useEffect, useMemo, useState } from 'react';

import { Loader2, Map, Pencil, Plus, Search, TowerControl } from 'lucide-react';

import * as api from '../../services/api';

import socketService from '../../services/socket';

import { useUser } from '../../contexts/UserContext';

import { t } from '../../utils/locale';

import airports from '../../config/airports';

import AtcStripBoard from './AtcStripBoard';

import AtcStripEditor from './AtcStripEditor';

import AtcCoordinationPanel from './AtcCoordinationPanel';

import AtcHistoryPanel from './AtcHistoryPanel';

import AtcChartsPanel from './AtcChartsPanel';

import AtcRoleSlots from './AtcRoleSlots';

import { OWNER_ROLE, canEditStrip, resolveClaimedRole } from './atcStripModel';

import './AtcStripPage.css';



const BLUE_AIRPORTS = airports.filter((a) => !a.isHeliport || a.isMainBase);



const ERROR_KEYS = {

  ROLE_NOT_CLAIMED: 'atc.errors.roleNotClaimed',

  ROLE_OCCUPIED: 'atc.errors.roleOccupied',

  MUST_RELEASE_CURRENT_ROLE: 'atc.errors.mustReleaseFirst',

  STRIP_NOT_IN_YOUR_SECTOR: 'atc.errors.stripNotInSector',

};



function translateApiError(err) {

  const key = ERROR_KEYS[err?.message] || ERROR_KEYS[err?.error];

  if (key) return t(key);

  return err?.message || String(err);

}



export default function AtcStripPage() {

  const { user } = useUser();

  const [airportId, setAirportId] = useState(BLUE_AIRPORTS[0]?.id || 'aleppo');

  const [strips, setStrips] = useState([]);

  const [nextActions, setNextActions] = useState({});

  const [history, setHistory] = useState([]);

  const [roleSlots, setRoleSlots] = useState({ GROUND: null, TOWER: null });

  const [tocQueue, setTocQueue] = useState([]);

  const [manualSort, setManualSort] = useState(false);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [selectedId, setSelectedId] = useState(null);

  const [editorOpen, setEditorOpen] = useState(false);

  const [editingStrip, setEditingStrip] = useState(null);

  const [search, setSearch] = useState('');

  const [activeDragId, setActiveDragId] = useState(null);

  const [toast, setToast] = useState('');

  const [chartsOpen, setChartsOpen] = useState(false);

  const [chartsWidth, setChartsWidth] = useState(420);



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

    setStrips(payload.strips || []);

    setNextActions(payload.nextActions || {});

    setHistory(payload.recentHistory || []);

    setRoleSlots(payload.roleSlots || { GROUND: null, TOWER: null });

    setTocQueue(payload.tocQueue || []);

    if (payload.manualSort !== undefined) setManualSort(payload.manualSort);

  }, []);



  const loadBoard = useCallback(async () => {

    try {

      setLoading(true);

      setError('');

      const payload = await api.getAtcBoard(airportId);

      applyBoardPayload(payload);

    } catch (err) {

      setError(err.message || 'Failed to load ATC board');

    } finally {

      setLoading(false);

    }

  }, [airportId, applyBoardPayload]);



  useEffect(() => {

    loadBoard();

  }, [loadBoard]);



  useEffect(() => {

    socketService.connect();

    const unsubscribe = socketService.on('atc:updated', (payload) => {

      if (payload?.airportId && payload.airportId !== airportId) return;

      applyBoardPayload(payload);

      if (payload?.lastAction && !['INITIAL', 'CLAIM_ROLE', 'RELEASE_ROLE'].includes(payload.lastAction)) {

        setToast(t('atc.toast.updated'));

        window.setTimeout(() => setToast(''), 2500);

      }

    });

    return () => unsubscribe();

  }, [airportId, applyBoardPayload]);



  useEffect(() => {

    const onKey = (event) => {

      if (event.target?.tagName === 'INPUT' || event.target?.tagName === 'TEXTAREA') return;

      if ((event.key === 'n' || event.key === 'N') && claimedRole) {

        setEditingStrip(null);

        setEditorOpen(true);

      }

      if (event.key === '/') {

        event.preventDefault();

        document.getElementById('atc-search')?.focus();

      }

    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);

  }, [claimedRole]);



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

    try {

      const payload = await api.releaseAtcRole(airportId, role);

      applyBoardPayload(payload);

      setSelectedId(null);

    } catch (err) {

      showError(err);

    }

  };



  const handleSaveStrip = async (form) => {

    if (!requireClaimed()) return;

    try {

      if (editingStrip?.id) {

        await api.patchAtcStrip(editingStrip.id, { ...form, airportId, role: claimedRole });

      } else {

        await api.createAtcStrip({ ...form, airportId, role: claimedRole });

      }

      setEditorOpen(false);

      setEditingStrip(null);

    } catch (err) {

      showError(err);

    }

  };



  const handleAction = async (strip, action) => {

    if (!requireClaimed()) return;

    try {

      await api.moveAtcStrip(strip.id, { airportId, action, role: claimedRole });

      setSelectedId(strip.id);

    } catch (err) {

      showError(err);

    }

  };



  const handleMoveStrip = async (strip, bayId) => {

    if (!requireClaimed()) return;

    try {

      await api.moveAtcStrip(strip.id, { airportId, bayId, role: claimedRole });

    } catch (err) {

      showError(err);

    }

  };



  const handleCancelHandoff = async (strip, targetBay) => {

    if (!requireClaimed() || claimedRole !== OWNER_ROLE.GROUND) return;

    try {

      await api.cancelAtcHandoff(strip.id, { airportId, role: claimedRole, targetBay });

      setSelectedId(null);

    } catch (err) {

      showError(err);

    }

  };



  const handleCoordinate = async (strip, accept) => {

    if (!requireClaimed() || claimedRole !== OWNER_ROLE.TOWER) return;

    try {

      await api.coordinateAtcStrip(strip.id, { airportId, accept, role: claimedRole });

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

      await api.deleteAtcStrip(selectedId, airportId, claimedRole);

      setSelectedId(null);

    } catch (err) {

      showError(err);

    }

  };



  const toggleManualSort = async () => {

    if (!requireClaimed()) return;

    try {

      const payload = await api.setAtcBoardSettings(airportId, !manualSort);

      applyBoardPayload(payload);

    } catch (err) {

      showError(err);

    }

  };



  if (loading) {

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

          <label className="atc-toolbar__select-wrap">

            <span>{t('atc.fields.airport')}</span>

            <select value={airportId} onChange={(e) => setAirportId(e.target.value)}>

              {BLUE_AIRPORTS.map((a) => (

                <option key={a.id} value={a.id}>{a.displayName || a.name}</option>

              ))}

            </select>

          </label>

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

              <button type="button" className="atc-toolbar__btn" onClick={toggleManualSort}>

                {manualSort ? t('atc.sortManual') : t('atc.sortAuto')}

              </button>

              <button

                type="button"

                className="atc-toolbar__btn atc-toolbar__btn--primary"

                onClick={() => { setEditingStrip(null); setEditorOpen(true); }}

              >

                <Plus className="w-4 h-4" />

                {t('atc.newStrip')}

              </button>

              {selectedEditable && (

                <button

                  type="button"

                  className="atc-toolbar__btn"

                  onClick={() => {

                    if (selectedStrip) { setEditingStrip(selectedStrip); setEditorOpen(true); }

                  }}

                >

                  <Pencil className="w-4 h-4" />

                  {t('atc.editStrip')}

                </button>

              )}

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

      {toast && <div className="atc-banner atc-banner--toast">{toast}</div>}



      <AtcRoleSlots

        roleSlots={roleSlots}

        userId={user?.id}

        claimedRole={claimedRole}

        onClaim={handleClaimRole}

        onRelease={handleReleaseRole}

      />



      {!claimedRole && (

        <div className="atc-banner atc-banner--warn">{t('atc.errors.claimToOperate')}</div>

      )}



      {claimedRole === OWNER_ROLE.TOWER && (

        <AtcCoordinationPanel

          strips={strips}

          tocQueue={tocQueue}

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

              onSelect={(strip) => setSelectedId(strip.id)}

              onEdit={(strip) => {

                if (canEditStrip(strip, claimedRole)) {

                  setEditingStrip(strip);

                  setEditorOpen(true);

                }

              }}

              onAction={handleAction}

              onCoordinate={handleCoordinate}

              onCancelHandoff={handleCancelHandoff}

              onMoveStrip={handleMoveStrip}

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

      </div>



      <AtcHistoryPanel entries={history} filterCallsign={search} />



      <AtcStripEditor

        open={editorOpen}

        strip={editingStrip}

        claimedRole={claimedRole}

        onClose={() => { setEditorOpen(false); setEditingStrip(null); }}

        onSave={handleSaveStrip}

      />

    </div>

  );

}


