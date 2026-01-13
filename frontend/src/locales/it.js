export default {
  general: {
    appTitle: 'DCS Warehouse',
    appSubtitle: 'Gestione Logistica',
    loading: 'Caricamento DCS Warehouse Viewer...',
    errorTitle: 'Errore nel caricamento dei dati',
    retry: 'Riprova',
    connection: {
      online: 'online',
      offline: 'offline',
      connecting: 'connessione...'
    },
    navigation: {
      dashboard: 'Dashboard',
      airports: 'Aeroporti',
      missions: 'Missioni',
      map: 'Mappa',
      admin: 'Admin'
    },
    statusLabels: {
      critical: 'CRITICO',
      high: 'ALTO',
      medium: 'MEDIO',
      ok: 'OK',
      normal: 'NORMALE',
      pending: 'In attesa',
      accepted: 'Accettata',
      expired: 'SCADUTA'
    },
    buttons: {
      accept: 'Accetta',
      complete: 'Completa',
      cancel: 'Annulla',
      createOrder: 'Crea Ordine',
      supplyRequest: 'Richiedi Rifornimento',
      login: 'Accedi',
      logout: 'Logout',
      verify: 'Verifica...'
    },
    prompts: {
      confirmComplete: 'Segnare questa missione come completata?',
      confirmCancel: 'Annullare questa missione?',
      confirmClearOrders: 'Sei sicuro di voler cancellare tutti gli ordini?'
    },
    form: {
      yourName: 'Il tuo nome...',
      pilotName: 'Nome pilota...'
    },
    clear: 'Rimuovi',
    unknown: 'Sconosciuto'
  },
  dashboard: {
    stats: {
      airports: 'Aeroporti',
      critical: 'Critici',
      missions: 'Missioni',
      accepted: 'Accettate'
    },
    searchPlaceholder: 'Cerca aeroporti...',
    sortByName: 'Nome',
    sortByCriticality: 'Criticità',
    pdfTooltip: 'Seleziona la directory dove salvare i PDF delle chart',
    emptyTitle: 'Nessun aeroporto trovato',
    emptySubtitle: 'Prova a modificare i filtri di ricerca'
  },
  airportsDirectory: {
    title: 'Aeroporti',
    subtitle: 'Elenco completo con informazioni di base',
    emptyTitle: 'Nessun aeroporto trovato',
    emptySubtitle: 'Nessun dato disponibile',
    labels: {
      icao: 'ICAO'
    },
    tags: {
      mainBase: 'Base principale',
      heliport: 'Eliporto',
      airport: 'Aeroporto',
      carrier: 'Carrier'
    }
  },
  airportDetails: {
    subtitle: 'Scheda completa aeroporto',
    back: 'Torna agli aeroporti',
    emptyTitle: 'Aeroporto non trovato',
    emptySubtitle: 'Seleziona un aeroporto dalla lista'
  },
  airportCard: {
    activeOrders: 'ORDINI ATTIVI',
    pdfUnavailable: 'Nessuna chart disponibile per questo aeroporto',
    refuel: 'Rifornimento',
    supplyOrders: 'Rifornimento',
    pendingLabel: 'Attesa',
    acceptedLabel: 'Accettata',
    baseLabel: 'Base Principale',
    elapsed: {
      seconds: '{{count}}s fa',
      minutes: '{{count}}m fa',
      hours: '{{count}}h fa',
      days: '{{count}}g fa'
    },
    remaining: {
      expired: 'SCADUTA',
      seconds: '{{count}}s',
      minutes: '{{count}}m',
      hours: '{{count}}h',
      days: '{{count}}g'
    },
    alerts: {
      selectWeapon: "Seleziona un'arma e inserisci una quantità valida",
      orderSuccess: 'Ordine creato con successo!',
      orderError: "Errore nella creazione dell'ordine: {{message}}",
      enterName: 'Inserisci il tuo nome',
      acceptError: "Errore nell'accettare la missione: {{message}}",
      completeError: "Errore nel completare la missione: {{message}}",
      cancelError: "Errore nell'annullare la missione: {{message}}"
    },
    headers: {
      weapons: 'Armi e Munizioni',
      weapon: 'Arma',
      quantity: 'Qtà',
      status: 'Stato',
      charts: 'Chart',
      type: 'Tipo',
      level: 'Livello',
      historical: 'Andamento Storico (7 giorni)',
      selectWeapon: "-- Seleziona un'arma per vedere il grafico --",
      selectWeaponInfo: "Seleziona un'arma dal menu per visualizzare il grafico",
      dataFrequency: '📊 Dati salvati ogni 4 ore'
    },
    modal: {
      title: 'Richiedi Rifornimento',
      airport: 'Aeroporto',
      selectWeapon: 'Seleziona Arma',
      quantityLabel: 'Quantità da Ordinare',
      suggested: 'Suggerito: {{value}}'
    },
    orderButton: 'Crea Ordine',
    cancelButton: 'Annulla',
    filters: {
      stocks: 'Scorte',
      requested: 'Richieste'
    },
    table: {
      weapon: 'Arma',
      qty: 'Qtà',
      status: 'Stato'
    },
    priority: {
      critical: '🔴 CRITICA',
      high: '🟠 ALTA',
      medium: '🟡 MEDIA'
    },
    recommended: {
      title: 'Consigliato:',
      helicopter: 'Elicottero',
      airplane: 'C-130',
      airdrop: 'Airdrop'
    },
    orders: {
      pilot: 'Pilota:',
      accept: 'Accetta',
      complete: 'Completa',
      cancel: 'Annulla',
      distanceSeparator: '•'
    },
    chart: {
      emptyTitle: "Seleziona un'arma dal menu per visualizzare il grafico",
      emptySubtitle: '📊 Dati salvati ogni 4 ore'
    },
    charts: {
      loading: 'Caricamento chart...',
      empty: 'Nessuna chart disponibile'
    }
  },
  mapView: {
    title: 'Mappa delle Rotte',
    subtitle: 'Visualizzazione geografica delle missioni attive',
    legend: {
      pending: 'Attesa',
      accepted: 'Accettata',
      airport: 'Aeroporto',
      heliport: 'Eliporto',
      carrier: 'Portaerei',
      base: 'Base'
    },
    popup: {
      heliport: 'ELIPORTO',
      airport: 'AEROPORTO',
      carrier: 'PORTAEREI',
      missions: '{{count}} missioni attive'
    },
    sidebar: {
      heading: 'Missioni',
      empty: 'Nessuna missione'
    },
    missionCard: {
      quantity: 'Qtà:',
      clickHint: '👆 Clicca di nuovo per aprire la pagina Missioni'
    }
  },
  missionDispatch: {
    title: 'Gestione Missioni',
    subtitle: 'Missioni di rifornimento attive',
    iso: {
      title: 'Carico ISO',
      container: 'ISO container',
      containerSmall: 'ISO container small',
      containerShort: 'ISO',
      containerSmallShort: 'ISO small',
      empty: 'Vuoto',
      emptySummary: 'Vuoto',
      overflow: 'Eccedenza:'
    },
    stats: {
      pending: 'Attesa',
      accepted: 'Accettate',
      critical: 'Critiche'
    },
    filters: {
      all: 'Tutte',
      pending: 'In Attesa',
      accepted: 'Accettate',
      route: 'Route',
      priority: 'Priorità',
      airport: 'Aeroporto',
      allRoutes: 'Tutte le route',
      allPriorities: 'Tutte le priorità'
    },
    emptyTitle: 'Nessuna missione disponibile',
    emptySubtitle: 'Le missioni appariranno qui quando le scorte saranno basse',
    timeAgo: {
      seconds: '{{count}}s fa',
      minutes: '{{count}}m fa',
      hours: '{{count}}h fa',
      days: '{{count}}g fa'
    },
    timeRemaining: {
      expired: 'SCADUTA',
      seconds: '{{count}}s',
      minutes: '{{count}}m',
      hours: '{{count}}h',
      days: '{{count}}g'
    },
    quantities: {
      stock: 'Scorte',
      requested: 'Richieste'
    },
    recommended: {
      label: 'Consigliato:',
      helicopter: 'Elicottero',
      airplane: 'C-130',
      airdrop: 'Airdrop'
    },
    pilot: 'Pilota:',
    accept: 'Accetta',
    complete: 'Completa',
    cancel: 'Annulla',
    ok: 'OK',
    namePlaceholder: 'Il tuo nome...'
  },
  admin: {
    accessRestricted: 'Accesso riservato agli amministratori',
    passwordPlaceholder: 'Inserisci password',
    sessionExpired: 'Sessione scaduta. Effettua nuovamente il login.',
    invalidPassword: 'Password non valida',
    debugTitle: 'Admin Panel',
    debugSubtitle: 'Gestione configurazioni e debug',
    tabs: {
      debug: 'Debug',
      rules: 'Regole',
      airports: 'Aeroporti'
    },
    buttons: {
      generateOrders: 'Genera Ordini',
      clearOrders: 'Cancella Ordini'
    },
    alerts: {
      generatedOrders: '✅ Generati {{count}} ordini',
      clearedOrders: '✅ Cancellati {{count}} ordini',
      error: '❌ Errore: {{message}}'
    }
  },
  map: {
    missionStatus: {
      pending: 'In attesa',
      accepted: 'Accettata'
    }
  },
  weaponChart: {
    loading: 'Caricamento dati...',
    noData: 'Nessun dato disponibile per questa arma',
    errorLoading: 'Errore nel caricamento dei dati',
    snapshotInfo: 'I dati vengono salvati ogni 4 ore. Attendi il prossimo snapshot.',
    selectWeapon: "Seleziona un'arma per vedere il grafico",
    stats: {
      current: 'Attuale',
      average: 'Media',
      min: 'Min',
      max: 'Max',
      change: 'Variazione',
      lastDays: 'Ultimi {{days}} giorni'
    },
    dataPoints: '📊 Dati raccolti ogni 4 ore • {{count}} punti dati',
    quantityLabel: 'Quantità: {{value}}'
  }
};
