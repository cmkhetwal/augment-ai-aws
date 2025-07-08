const fuzzysort = require('fuzzysort');

class SearchService {
  constructor() {
    this.searchIndex = new Map();
    this.lastIndexUpdate = null;
  }

  // Build search index from instances
  buildSearchIndex(instances) {
    this.searchIndex.clear();
    
    instances.forEach(instance => {
      const instanceName = instance.Tags?.find(tag => tag.Key === 'Name')?.Value || instance.InstanceId;
      
      // Create searchable fields
      const searchableFields = {
        name: instanceName,
        instanceId: instance.InstanceId,
        instanceType: instance.InstanceType,
        publicIp: instance.PublicIpAddress || '',
        privateIp: instance.PrivateIpAddress || '',
        region: instance.Region || '',
        state: instance.State?.Name || '',
        vpcId: instance.VpcId || '',
        subnetId: instance.SubnetId || '',
        availabilityZone: instance.Placement?.AvailabilityZone || '',
        keyName: instance.KeyName || '',
        platform: instance.Platform || 'linux',
        architecture: instance.Architecture || '',
        tags: instance.Tags?.map(tag => `${tag.Key}:${tag.Value}`).join(' ') || ''
      };

      // Store in search index
      this.searchIndex.set(instance.InstanceId, {
        instance,
        searchableFields,
        searchText: Object.values(searchableFields).join(' ').toLowerCase()
      });
    });

    this.lastIndexUpdate = new Date();
    console.log(`Search index built with ${instances.length} instances`);
  }

  // Enhanced IP matching with fuzzy logic
  matchesIP(ip, searchTerm) {
    if (!ip || !searchTerm) return false;
    
    const ipStr = ip.toString();
    const search = searchTerm.toString();
    
    // Exact match
    if (ipStr.includes(search)) return true;
    
    // Partial IP matching (e.g., "10.0" matches "10.0.1.2")
    const ipParts = ipStr.split('.');
    const searchParts = search.split('.');
    
    if (searchParts.length <= ipParts.length) {
      return searchParts.every((part, index) => {
        if (index >= ipParts.length) return false;
        return ipParts[index].startsWith(part);
      });
    }
    
    // Fuzzy matching for typos (e.g., "10.0.1.3" matches "10.0.1.2" with score)
    if (search.length >= 3) {
      const result = fuzzysort.single(search, ipStr);
      return result && result.score > -1000;
    }
    
    return false;
  }

  // Advanced search with multiple criteria
  search(query, options = {}) {
    const {
      limit = 20,
      includeOffline = true,
      regions = [],
      instanceTypes = [],
      states = []
    } = options;

    if (!query || query.length < 1) {
      return [];
    }

    const searchTerm = query.toLowerCase().trim();
    const results = [];

    // Search through all indexed instances
    for (const [instanceId, indexedData] of this.searchIndex.entries()) {
      const { instance, searchableFields } = indexedData;
      let score = 0;
      let matchedFields = [];

      // Apply filters first
      if (regions.length > 0 && !regions.includes(instance.Region)) continue;
      if (instanceTypes.length > 0 && !instanceTypes.includes(instance.InstanceType)) continue;
      if (states.length > 0 && !states.includes(instance.State?.Name)) continue;
      if (!includeOffline && instance.State?.Name !== 'running') continue;

      // Exact matches get highest score
      if (searchableFields.name.toLowerCase() === searchTerm) {
        score += 1000;
        matchedFields.push({ field: 'name', value: searchableFields.name, type: 'exact' });
      } else if (searchableFields.instanceId.toLowerCase() === searchTerm) {
        score += 900;
        matchedFields.push({ field: 'instanceId', value: searchableFields.instanceId, type: 'exact' });
      }

      // IP address matching (high priority)
      if (this.matchesIP(searchableFields.publicIp, searchTerm)) {
        score += 800;
        matchedFields.push({ field: 'publicIp', value: searchableFields.publicIp, type: 'ip' });
      }
      if (this.matchesIP(searchableFields.privateIp, searchTerm)) {
        score += 750;
        matchedFields.push({ field: 'privateIp', value: searchableFields.privateIp, type: 'ip' });
      }

      // Partial matches
      Object.entries(searchableFields).forEach(([field, value]) => {
        if (!value) return;
        
        const valueStr = value.toString().toLowerCase();
        
        if (field === 'publicIp' || field === 'privateIp') {
          // Already handled above
          return;
        }
        
        if (valueStr.includes(searchTerm)) {
          let fieldScore = 0;
          
          switch (field) {
            case 'name':
              fieldScore = valueStr.startsWith(searchTerm) ? 600 : 400;
              break;
            case 'instanceId':
              fieldScore = valueStr.startsWith(searchTerm) ? 500 : 300;
              break;
            case 'instanceType':
              fieldScore = 200;
              break;
            case 'region':
              fieldScore = 150;
              break;
            case 'state':
              fieldScore = 100;
              break;
            default:
              fieldScore = 50;
          }
          
          score += fieldScore;
          matchedFields.push({ 
            field, 
            value, 
            type: valueStr.startsWith(searchTerm) ? 'prefix' : 'contains' 
          });
        }
      });

      // Fuzzy search for typos
      if (score === 0 && searchTerm.length >= 3) {
        const fuzzyResult = fuzzysort.single(searchTerm, indexedData.searchText);
        if (fuzzyResult && fuzzyResult.score > -500) {
          score = Math.max(0, fuzzyResult.score + 1000);
          matchedFields.push({ field: 'fuzzy', value: searchTerm, type: 'fuzzy' });
        }
      }

      // Add to results if we have a match
      if (score > 0) {
        results.push({
          instance,
          score,
          matchedFields,
          relevance: this.calculateRelevance(instance, matchedFields)
        });
      }
    }

    // Sort by score (descending) and then by relevance
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.relevance - a.relevance;
    });

    return results.slice(0, limit);
  }

  // Calculate relevance based on instance state and match quality
  calculateRelevance(instance, matchedFields) {
    let relevance = 0;
    
    // Running instances are more relevant
    if (instance.State?.Name === 'running') relevance += 100;
    
    // Recent instances are more relevant
    if (instance.LaunchTime) {
      const daysSinceLaunch = (Date.now() - new Date(instance.LaunchTime)) / (1000 * 60 * 60 * 24);
      relevance += Math.max(0, 30 - daysSinceLaunch);
    }
    
    // Instances with names are more relevant
    const hasName = instance.Tags?.some(tag => tag.Key === 'Name' && tag.Value);
    if (hasName) relevance += 20;
    
    // Multiple field matches increase relevance
    relevance += matchedFields.length * 5;
    
    return relevance;
  }

  // Get search suggestions for autocomplete
  getSuggestions(query, limit = 10) {
    if (!query || query.length < 1) {
      return [];
    }

    const results = this.search(query, { limit: limit * 2 });
    const suggestions = new Map();

    results.forEach(result => {
      const { instance, matchedFields } = result;
      const instanceName = instance.Tags?.find(tag => tag.Key === 'Name')?.Value || instance.InstanceId;
      const state = instance.State?.Name || 'unknown';
      const stateColor = state === 'running' ? '#52c41a' : state === 'stopped' ? '#f5222d' : '#faad14';

      matchedFields.forEach(match => {
        const key = `${match.field}_${match.value}`;
        if (!suggestions.has(key)) {
          let displayValue = match.value;
          let label = match.value;
          let category = match.field;

          // Format display based on field type
          switch (match.field) {
            case 'name':
              label = `${displayValue} (${instance.InstanceId})`;
              category = 'Instance Name';
              break;
            case 'instanceId':
              label = `${displayValue} (${instanceName})`;
              category = 'Instance ID';
              break;
            case 'publicIp':
              label = `${displayValue} - Public IP (${instanceName})`;
              category = 'IP Address';
              break;
            case 'privateIp':
              label = `${displayValue} - Private IP (${instanceName})`;
              category = 'IP Address';
              break;
            case 'instanceType':
              label = `${displayValue} (${instanceName})`;
              category = 'Instance Type';
              break;
            case 'region':
              label = `${displayValue} (${instanceName})`;
              category = 'Region';
              break;
          }

          suggestions.set(key, {
            value: displayValue,
            label,
            category,
            instance,
            matchType: match.type,
            state,
            stateColor
          });
        }
      });
    });

    return Array.from(suggestions.values())
      .sort((a, b) => {
        // Sort by category priority, then by state
        const categoryPriority = {
          'Instance Name': 5,
          'Instance ID': 4,
          'IP Address': 3,
          'Instance Type': 2,
          'Region': 1
        };
        
        const aPriority = categoryPriority[a.category] || 0;
        const bPriority = categoryPriority[b.category] || 0;
        
        if (aPriority !== bPriority) return bPriority - aPriority;
        
        // Running instances first
        const aRunning = a.state === 'running' ? 1 : 0;
        const bRunning = b.state === 'running' ? 1 : 0;
        
        return bRunning - aRunning;
      })
      .slice(0, limit);
  }

  // Get search statistics
  getSearchStats() {
    return {
      totalInstances: this.searchIndex.size,
      lastIndexUpdate: this.lastIndexUpdate,
      indexedFields: [
        'name', 'instanceId', 'instanceType', 'publicIp', 'privateIp',
        'region', 'state', 'vpcId', 'subnetId', 'availabilityZone'
      ]
    };
  }

  // Clear search index
  clearIndex() {
    this.searchIndex.clear();
    this.lastIndexUpdate = null;
  }
}

module.exports = new SearchService();
