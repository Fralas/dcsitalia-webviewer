export default {
  general: {
    appTitle: 'DCS Warehouse',
    appSubtitle: 'Logistics Management',
    loading: 'Loading DCS Warehouse Viewer...',
    errorTitle: 'Error Loading Data',
    retry: 'Retry',
    connection: {
      online: 'online',
      offline: 'offline',
      connecting: 'connecting...'
    },
    navigation: {
      dashboard: 'Dashboard',
      airports: 'Airports',
      missions: 'Missions',
      map: 'Map',
      admin: 'Admin'
    },
    statusLabels: {
      critical: 'CRITICAL',
      high: 'HIGH',
      medium: 'MEDIUM',
      ok: 'OK',
      normal: 'NORMAL',
      pending: 'Pending',
      accepted: 'Accepted',
      expired: 'EXPIRED'
    },
    buttons: {
      accept: 'Accept',
      complete: 'Complete',
      cancel: 'Cancel',
      createOrder: 'Create Order',
      supplyRequest: 'Supply Request',
      login: 'Login',
      logout: 'Logout',
      verify: 'Verifying...'
    },
    prompts: {
      confirmComplete: 'Mark this mission as completed?',
      confirmCancel: 'Cancel this mission?',
      confirmClearOrders: 'Are you sure you want to delete all orders?'
    },
    form: {
      yourName: 'Your name...',
      pilotName: 'Pilot name...'
    },
    clear: 'Clear',
    unknown: 'Unknown'
  },
  dashboard: {
    stats: {
      airports: 'Airports',
      critical: 'Critical',
      missions: 'Missions',
      accepted: 'Accepted'
    },
    searchPlaceholder: '🔍 Search airports...',
    sortByName: '📝 Name',
    sortByCriticality: '⚠️ Criticality',
    pdfTooltip: 'Select the directory where charts PDFs should be saved',
    emptyTitle: 'No airports found',
    emptySubtitle: 'Try adjusting your search filters'
  },
  airportsDirectory: {
    title: 'Airports',
    subtitle: 'Full list with basic information',
    emptyTitle: 'No airports found',
    emptySubtitle: 'No data available',
    labels: {
      icao: 'ICAO'
    },
    tags: {
      mainBase: 'Main base',
      heliport: 'Heliport',
      airport: 'Airport',
      carrier: 'Carrier'
    }
  },
  airportDetails: {
    subtitle: 'Full airport details',
    back: 'Back to airports',
    emptyTitle: 'Airport not found',
    emptySubtitle: 'Select an airport from the list'
  },
  airportCard: {
    activeOrders: 'ACTIVE ORDERS',
    pdfUnavailable: 'No chart available for this airport',
    refuel: 'Refuel',
    supplyOrders: 'Supply',
    pendingLabel: 'Pending',
    acceptedLabel: 'Accepted',
    baseLabel: 'Main Base',
    elapsed: {
      seconds: '{{count}}s ago',
      minutes: '{{count}}m ago',
      hours: '{{count}}h ago',
      days: '{{count}}d ago'
    },
    remaining: {
      expired: 'EXPIRED',
      seconds: '{{count}}s',
      minutes: '{{count}}m',
      hours: '{{count}}h',
      days: '{{count}}d'
    },
    alerts: {
      selectWeapon: 'Select a weapon and enter a valid quantity',
      orderSuccess: 'Order created successfully!',
      orderError: 'Error creating order: {{message}}',
      enterName: 'Enter your name',
      acceptError: "Error accepting mission: {{message}}",
      completeError: "Error completing mission: {{message}}",
      cancelError: "Error cancelling mission: {{message}}"
    },
    headers: {
      weapons: 'Weapons & Munitions',
      weapon: 'Weapon',
      quantity: 'Qty',
      status: 'Status',
      charts: 'Charts',
      type: 'Type',
      level: 'Level',
      historical: 'Historical Trend (7 days)',
      selectWeapon: "-- Select a weapon to view the chart --",
      selectWeaponInfo: 'Select a weapon from the menu to view the chart',
      dataFrequency: '📊 Data saved every 4 hours'
    },
    modal: {
      title: 'Request Supply',
      airport: 'Airport',
      selectWeapon: 'Select Weapon',
      quantityLabel: 'Quantity to Order',
      suggested: 'Suggested: {{value}}'
    },
    orderButton: 'Create Order',
    cancelButton: 'Cancel',
    filters: {
      stocks: 'Stock',
      requested: 'Requested'
    },
    table: {
      weapon: 'Weapon',
      qty: 'Qty',
      status: 'Status'
    },
    priority: {
      critical: '🔴 CRITICAL',
      high: '🟠 HIGH',
      medium: '🟡 MEDIUM'
    },
    recommended: {
      title: 'Recommended:',
      helicopter: 'Helicopter',
      airplane: 'C-130',
      airdrop: 'Airdrop'
    },
    orders: {
      pilot: 'Pilot:',
      accept: 'Accept',
      complete: 'Complete',
      cancel: 'Cancel',
      distanceSeparator: '•'
    },
    chart: {
      emptyTitle: 'Select a weapon from the menu to view the chart',
      emptySubtitle: '📊 Data saved every 4 hours'
    },
    charts: {
      loading: 'Loading charts...',
      empty: 'No charts available'
    }
  },
  mapView: {
    title: 'Route Map',
    subtitle: 'Geographic view of active missions',
    legend: {
      pending: 'Pending',
      accepted: 'Accepted',
      airport: 'Airport',
      heliport: 'Heliport',
      carrier: 'Carrier',
      base: 'Base'
    },
    popup: {
      heliport: 'HELIPORT',
      airport: 'AIRPORT',
      carrier: 'CARRIER',
      missions: '{{count}} active missions'
    },
    sidebar: {
      heading: 'Missions',
      empty: 'No missions'
    },
    missionCard: {
      quantity: 'Qty:',
      clickHint: '👆 Click again to open the Missions page'
    }
  },
  missionDispatch: {
    title: 'Mission Management',
    subtitle: 'Active resupply missions',
    iso: {
      title: 'ISO Load',
      container: 'ISO container',
      containerSmall: 'ISO container small',
      containerShort: 'ISO',
      containerSmallShort: 'ISO small',
      empty: 'Empty',
      emptySummary: 'Empty',
      overflow: 'Overflow:'
    },
    stats: {
      pending: 'Pending',
      accepted: 'Accepted',
      critical: 'Critical'
    },
    filters: {
      all: 'All',
      pending: 'Pending',
      accepted: 'Accepted',
      route: 'Route',
      priority: 'Priority',
      airport: 'Airport',
      allRoutes: 'All routes',
      allPriorities: 'All priorities'
    },
    emptyTitle: 'No missions available',
    emptySubtitle: 'Missions will appear here when stock levels are low',
    timeAgo: {
      seconds: '{{count}}s ago',
      minutes: '{{count}}m ago',
      hours: '{{count}}h ago',
      days: '{{count}}d ago'
    },
    timeRemaining: {
      expired: 'EXPIRED',
      seconds: '{{count}}s',
      minutes: '{{count}}m',
      hours: '{{count}}h',
      days: '{{count}}d'
    },
    quantities: {
      stock: 'Stock',
      requested: 'Requested'
    },
    recommended: {
      label: 'Recommended:',
      helicopter: 'Helicopter',
      airplane: 'C-130',
      airdrop: 'Airdrop'
    },
    pilot: 'Pilot:',
    accept: 'Accept',
    complete: 'Complete',
    cancel: 'Cancel',
    ok: 'OK',
    namePlaceholder: 'Your name...'
  },
  admin: {
    accessRestricted: 'Access reserved for administrators',
    passwordPlaceholder: 'Enter password',
    sessionExpired: 'Session expired. Please login again.',
    invalidPassword: 'Invalid password',
    debugTitle: 'Admin Panel',
    debugSubtitle: 'Configuration and debug management',
    tabs: {
      debug: 'Debug',
      rules: 'Rules',
      airports: 'Airports'
    },
    buttons: {
      generateOrders: 'Generate Orders',
      clearOrders: 'Clear Orders'
    },
    alerts: {
      generatedOrders: '✅ Generated {{count}} orders',
      clearedOrders: '✅ Deleted {{count}} orders',
      error: '❌ Error: {{message}}'
    }
  },
  map: {
    missionStatus: {
      pending: 'Pending',
      accepted: 'Accepted'
    }
  },
  weaponChart: {
    loading: 'Loading data...',
    noData: 'No data available for this weapon',
    errorLoading: 'Error loading data',
    snapshotInfo: 'Data is saved every 4 hours. Please wait for the next snapshot.',
    selectWeapon: 'Select a weapon to view the chart',
    stats: {
      current: 'Current',
      average: 'Average',
      min: 'Min',
      max: 'Max',
      change: 'Change',
      lastDays: 'Last {{days}} days'
    },
    dataPoints: '📊 Data collected every 4 hours • {{count}} data points',
    quantityLabel: 'Quantity: {{value}}'
  }
};
