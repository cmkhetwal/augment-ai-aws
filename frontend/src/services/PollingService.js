class PollingService {
  constructor() {
    this.pollingInterval = null;
    this.intervalTime = 10000; // Poll every 10 seconds
    this.listeners = {
      data: [],
      connect: [],
      disconnect: [],
      error: []
    };
    this.connected = false;
    this.isFirstFetch = true;
    this.currentFilters = {
      account: null,
      region: null
    };
  }

  connect() {
    console.log("PollingService: Starting polling service...");
    this.connected = true;
    
    // Notify connection immediately
    setTimeout(() => {
      console.log("PollingService: Triggering connect event");
      this.notifyListeners("connect");
    }, 100);
    
    // Start polling immediately
    this.fetchData();
    
    // Set up interval polling
    this.pollingInterval = setInterval(() => {
      this.fetchData();
    }, this.intervalTime);
  }

  // Update filters for polling service
  setFilters(account, region) {
    this.currentFilters.account = account;
    this.currentFilters.region = region;
    console.log('PollingService: Filters updated:', this.currentFilters);
  }

  async fetchData() {
    try {
      // Get auth token from localStorage
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Import API configuration
      const { API_ENDPOINTS } = await import('../config/api.js');
      
      // Build query parameters for filtering
      const params = new URLSearchParams();
      if (this.currentFilters.account) params.append('account', this.currentFilters.account);
      if (this.currentFilters.region) params.append('region', this.currentFilters.region);
      params.append('sortBy', 'usage');
      params.append('useCache', 'true');

      // Use filtered endpoint
      const url = `${API_ENDPOINTS.DASHBOARD_FILTERED}?${params.toString()}`;
      console.log('PollingService: Fetching filtered data from:', url);
      
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON response but got: ${contentType}. Response: ${text.substring(0, 200)}...`);
      }

      const responseData = await response.json();
      
      // Handle the filtered API response format
      let data;
      if (responseData.success && responseData.data) {
        data = responseData.data;
      } else {
        data = responseData;
      }
      
      // Transform data to match expected format
      const transformedData = {
        type: this.isFirstFetch ? "initial_data" : "dashboard_update",
        data: data
      };

      console.log(`PollingService: Filtered data fetched successfully, type: ${transformedData.type}`);
      console.log(`PollingService: Applied filters - Account: ${this.currentFilters.account || 'all'}, Region: ${this.currentFilters.region || 'all'}`);
      console.log("PollingService: Data keys:", Object.keys(data));
      this.notifyListeners("data", transformedData);
      
      // After first fetch, subsequent fetches will be updates
      this.isFirstFetch = false;
      
    } catch (error) {
      console.error("PollingService: Error fetching data:", error);
      this.notifyListeners("error", error);
    }
  }

  disconnect() {
    console.log("PollingService: Stopping polling service...");
    this.connected = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.notifyListeners("disconnect");
  }

  onMessage(callback) {
    this.listeners.data.push(callback);
  }

  onConnect(callback) {
    this.listeners.connect.push(callback);
  }

  onDisconnect(callback) {
    this.listeners.disconnect.push(callback);
  }

  onError(callback) {
    this.listeners.error.push(callback);
  }

  notifyListeners(event, data) {
    console.log(`PollingService: Notifying ${this.listeners[event].length} listeners for event: ${event}`);
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`PollingService: Error in ${event} listener:`, error);
      }
    });
  }

  isConnected() {
    return this.connected;
  }

  getReadyState() {
    return this.connected ? 1 : 0; // 1 = OPEN, 0 = CLOSED
  }

  // Add these properties to match WebSocket interface
  get readyState() {
    return this.connected ? 1 : 0;
  }

  get CONNECTING() { return 0; }
  get OPEN() { return 1; }
  get CLOSING() { return 2; }
  get CLOSED() { return 3; }
}

export default PollingService;
