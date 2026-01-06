'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { X, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import applicationService from '@/services/api/application.service';

interface FilterOptions {
  countries: string[];
  cities: string[];
  education_levels: string[];
  current_statuses: string[];
  excel_skill_levels: string[];
  referral_sources: string[];
}

interface AdvancedFiltersProps {
  onFiltersChange: (filters: any) => void;
  initialFilters?: any;
}

export default function AdvancedFilters({ onFiltersChange, initialFilters = {} }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    countries: [],
    cities: [],
    education_levels: [],
    current_statuses: [],
    excel_skill_levels: [],
    referral_sources: []
  });
  
  const [filters, setFilters] = useState({
    country: '',
    city: '',
    education_level: '',
    current_status: '',
    excel_skill_level: '',
    referral_source: '',
    date_from: '',
    date_to: '',
    min_score: '',
    max_score: '',
    score_type: 'final_rank_score',
    ...initialFilters
  });

  // Load filter options from backend
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const stats = await applicationService.getSearchStatistics();
        setFilterOptions(stats.filter_options);
      } catch (error) {
        console.error('Failed to load filter options:', error);
      }
    };

    if (isOpen) {
      loadFilterOptions();
    }
  }, [isOpen]);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // Remove empty values before passing to parent
    const cleanFilters = Object.fromEntries(
      Object.entries(newFilters).filter(([_, v]) => v !== '' && v !== undefined)
    );
    onFiltersChange(cleanFilters);
  };

  const clearFilters = () => {
    const emptyFilters = {
      country: '',
      city: '',
      education_level: '',
      current_status: '',
      excel_skill_level: '',
      referral_source: '',
      date_from: '',
      date_to: '',
      min_score: '',
      max_score: '',
      score_type: 'final_rank_score'
    };
    setFilters(emptyFilters);
    onFiltersChange({});
  };

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => value !== '' && value !== undefined).length;
  };

  const getActiveFiltersBadges = () => {
    const badges = [];
    if (filters.country) badges.push(`Country: ${filters.country}`);
    if (filters.city) badges.push(`City: ${filters.city}`);
    if (filters.education_level) badges.push(`Education: ${filters.education_level}`);
    if (filters.current_status) badges.push(`Status: ${filters.current_status}`);
    if (filters.excel_skill_level) badges.push(`Excel: ${filters.excel_skill_level}`);
    if (filters.referral_source) badges.push(`Source: ${filters.referral_source}`);
    if (filters.date_from) badges.push(`From: ${filters.date_from}`);
    if (filters.date_to) badges.push(`To: ${filters.date_to}`);
    if (filters.min_score || filters.max_score) {
      badges.push(`Score: ${filters.min_score || 0}-${filters.max_score || 100}`);
    }
    return badges;
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4" />
                <CardTitle className="text-sm">Advanced Filters</CardTitle>
                {getActiveFiltersCount() > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {getActiveFiltersCount()} active
                  </Badge>
                )}
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            
            {/* Show active filters as badges when collapsed */}
            {!isOpen && getActiveFiltersCount() > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {getActiveFiltersBadges().slice(0, 3).map((badge, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {badge}
                  </Badge>
                ))}
                {getActiveFiltersBadges().length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{getActiveFiltersBadges().length - 3} more
                  </Badge>
                )}
              </div>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Location Filters */}
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={filters.country} onValueChange={(value) => handleFilterChange('country', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Countries</SelectItem>
                    {filterOptions.countries.map(country => (
                      <SelectItem key={country} value={country}>{country}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>City</Label>
                <Select value={filters.city} onValueChange={(value) => handleFilterChange('city', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Cities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Cities</SelectItem>
                    {filterOptions.cities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Education & Status Filters */}
              <div className="space-y-2">
                <Label>Education Level</Label>
                <Select value={filters.education_level} onValueChange={(value) => handleFilterChange('education_level', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Levels</SelectItem>
                    {filterOptions.education_levels.map(level => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Current Status</Label>
                <Select value={filters.current_status} onValueChange={(value) => handleFilterChange('current_status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Statuses</SelectItem>
                    {filterOptions.current_statuses.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Excel Skill Level</Label>
                <Select value={filters.excel_skill_level} onValueChange={(value) => handleFilterChange('excel_skill_level', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Levels</SelectItem>
                    {filterOptions.excel_skill_levels.map(level => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Referral Source</Label>
                <Select value={filters.referral_source} onValueChange={(value) => handleFilterChange('referral_source', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Sources</SelectItem>
                    {filterOptions.referral_sources.map(source => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filters */}
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => handleFilterChange('date_from', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => handleFilterChange('date_to', e.target.value)}
                />
              </div>

              {/* Score Filters */}
              <div className="space-y-2">
                <Label>Score Type</Label>
                <Select value={filters.score_type} onValueChange={(value) => handleFilterChange('score_type', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="final_rank_score">Final Rank Score</SelectItem>
                    <SelectItem value="application_score">Application Score</SelectItem>
                    <SelectItem value="readiness_score">Readiness Score</SelectItem>
                    <SelectItem value="commitment_score">Commitment Score</SelectItem>
                    <SelectItem value="risk_score">Risk Score</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Min Score</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.min_score}
                  onChange={(e) => handleFilterChange('min_score', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Max Score</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.max_score}
                  onChange={(e) => handleFilterChange('max_score', e.target.value)}
                  placeholder="100"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={clearFilters} size="sm">
                <X className="w-3 h-3 mr-1" />
                Clear All
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}