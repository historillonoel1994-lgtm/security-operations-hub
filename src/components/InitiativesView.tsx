import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { MemberInitiative, InitiativeStatus, InitiativeType, InitiativeCategory } from '../types/index.ts';
import { INITIATIVE_STATUS_CONFIG, INITIATIVE_CATEGORIES, INITIATIVE_TYPES } from '../lib/initiativeConstants.ts';
import { PHILIPPINE_REGIONS } from '../lib/philippinesRegions.ts';
import { formatPhilippineDate } from '../lib/dateUtils.ts';
import {
  Lightbulb,
  Plus,
  Search,
  Filter,
  Award,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  User,
  MapPin,
  Calendar,
  ArrowRight,
  Database,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Play,
  Edit3,
} from 'lucide-react';

interface InitiativesViewProps {
  onCreateInitiative: () => void;
  onSelectInitiative: (initiative: MemberInitiative) => void;
  onOpenEditInitiative: (initiative: MemberInitiative) => void;
  onOpenSubmitAccomplishment: (initiative: MemberInitiative) => void;
}

export const InitiativesView: React.FC<InitiativesViewProps> = ({
  onCreateInitiative,
  onSelectInitiative,
  onOpenEditInitiative,
  onOpenSubmitAccomplishment,
}) => {
  const { currentUser, isManager, isApproved } = useAuth();
  const { initiatives, initiativeSummary, initiativesTableReady } = useData();

  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');

  const filteredInitiatives = useMemo(() => {
    return initiatives.filter((item) => {
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.submitted_by_name || '').toLowerCase().includes(q) ||
          item.region.toLowerCase().includes(q) ||
          (item.location || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Type
      if (typeFilter !== 'all' && item.initiative_type !== typeFilter) {
        return false;
      }

      // Category
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }

      // Region
      if (regionFilter !== 'all' && item.region !== regionFilter) {
        return false;
      }

      // Tab
      if (activeTab === 'all') return true;
      if (activeTab === 'pending_review') {
        return item.status === 'pending_review' || item.status === 'accomplishment_submitted';
      }
      if (activeTab === 'approved') {
        return item.status === 'approved_to_proceed' || item.status === 'in_progress';
      }
      return item.status === activeTab;
    });
  }, [initiatives, searchTerm, typeFilter, categoryFilter, regionFilter, activeTab]);

  const tabs = [
    { id: 'all', label: 'All Initiatives', count: initiatives.length },
    {
      id: 'pending_review',
      label: isManager ? 'Awaiting Review' : 'Pending Review',
      count: initiativeSummary.pendingReview,
      badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300',
    },
    {
      id: 'approved',
      label: 'Approved / Active',
      count: initiativeSummary.approvedProposals,
    },
    {
      id: 'recognized',
      label: 'Recognized Initiatives',
      count: initiativeSummary.recognized,
      badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
    },
    {
      id: 'returned',
      label: 'Returned for Revision',
      count: initiativeSummary.returned,
      badgeColor: 'bg-rose-100 text-rose-900 border border-rose-300',
    },
    ...(!isManager
      ? [
          {
            id: 'draft',
            label: 'My Drafts',
            count: initiatives.filter((i) => i.status === 'draft').length,
          },
        ]
      : []),
    {
      id: 'rejected',
      label: 'Rejected',
      count: initiativeSummary.rejected,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {isManager ? 'Initiative Reviews & Validation' : 'My Security Initiatives'}
            </h1>
            <span className="text-xs bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
              Recognition System
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {isManager
              ? 'Evaluate, authorize, and officially recognize independent security assessments and proactive checks'
              : 'Propose proactive security improvements or submit self-initiated accomplishments for Manager recognition'}
          </p>
        </div>

        {/* Action Button: Members can create initiatives */}
        {isApproved && (
          <button
            type="button"
            onClick={onCreateInitiative}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg shadow-sm transition space-x-2 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Initiative</span>
          </button>
        )}
      </div>

      {/* Migration Notice if table not yet run in Supabase */}
      {!initiativesTableReady && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start space-x-3 text-xs text-amber-950">
          <Database className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block text-sm">Supabase Table Migration Ready</span>
            <p className="leading-relaxed">
              To enable cloud database persistence for member initiatives, run the file{' '}
              <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300 font-bold text-amber-900">
                supabase/migration_initiatives.sql
              </code>{' '}
              in your <strong>Supabase Dashboard &gt; SQL Editor</strong>.
            </p>
          </div>
        </div>
      )}

      {/* 5 Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Submitted */}
        <div
          onClick={() => setActiveTab('all')}
          className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Submitted
            </span>
            <Lightbulb className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {initiativeSummary.totalSubmitted}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Proposals & checks</div>
        </div>

        {/* Pending Review */}
        <div
          onClick={() => setActiveTab('pending_review')}
          className={`p-4 rounded-xl border shadow-xs transition cursor-pointer ${
            initiativeSummary.pendingReview > 0
              ? 'bg-amber-50/80 border-amber-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800 uppercase tracking-wider">
              {isManager ? 'Awaiting Review' : 'Pending Review'}
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-900">
            {initiativeSummary.pendingReview}
          </div>
          <div className="text-[11px] text-amber-700/80 mt-0.5">Awaiting Manager action</div>
        </div>

        {/* Approved Proposals */}
        <div
          onClick={() => setActiveTab('approved')}
          className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Approved / Active
            </span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {initiativeSummary.approvedProposals}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Authorized for work</div>
        </div>

        {/* Officially Recognized */}
        <div
          onClick={() => setActiveTab('recognized')}
          className={`p-4 rounded-xl border shadow-xs transition cursor-pointer ${
            initiativeSummary.recognized > 0
              ? 'bg-emerald-50/80 border-emerald-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800 uppercase tracking-wider">
              Recognized
            </span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-900">
            {initiativeSummary.recognized}
          </div>
          <div className="text-[11px] text-emerald-700/80 mt-0.5">Validated accomplishments</div>
        </div>

        {/* Returned for Revision */}
        <div
          onClick={() => setActiveTab('returned')}
          className={`p-4 rounded-xl border shadow-xs transition cursor-pointer col-span-2 sm:col-span-1 ${
            initiativeSummary.returned > 0
              ? 'bg-rose-50/80 border-rose-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-800 uppercase tracking-wider">
              For Revision
            </span>
            <RotateCcw className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-900">
            {initiativeSummary.returned}
          </div>
          <div className="text-[11px] text-rose-700/80 mt-0.5">Needs clarification</div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-2 overflow-x-auto pb-1 text-xs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 font-medium rounded-t-lg transition whitespace-nowrap flex items-center space-x-1.5 ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-700 text-blue-800 font-bold bg-blue-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  tab.badgeColor || (activeTab === tab.id ? 'bg-blue-200 text-blue-900' : 'bg-slate-200 text-slate-700')
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search initiatives, concerns, or facilities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
          />
        </div>

        {/* Type Filter */}
        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
          >
            <option value="all">All Initiative Types</option>
            {INITIATIVE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
          >
            <option value="all">All Categories</option>
            {INITIATIVE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Region Filter */}
        <div>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
          >
            <option value="all">All Philippine Sites / Facilities</option>
            {PHILIPPINE_REGIONS.map((reg) => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Initiatives List */}
      {filteredInitiatives.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-xs space-y-2">
          <Lightbulb className="w-10 h-10 mx-auto text-slate-300 mb-1" />
          <h3 className="font-semibold text-slate-800 text-sm">No security initiatives found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchTerm || typeFilter !== 'all' || categoryFilter !== 'all' || regionFilter !== 'all' || activeTab !== 'all'
              ? 'Try adjusting your search query or status filter.'
              : 'No initiatives submitted yet. Click "+ New Initiative" to submit a proactive security check or proposal.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredInitiatives.map((item) => {
            const statusCfg = INITIATIVE_STATUS_CONFIG[item.status] || INITIATIVE_STATUS_CONFIG.draft;
            const typeCfg = INITIATIVE_TYPES.find((t) => t.value === item.initiative_type) || INITIATIVE_TYPES[0];
            const isAuthor = item.submitted_by === currentUser?.id;

            return (
              <div
                key={item.id}
                onClick={() => onSelectInitiative(item)}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-blue-400 hover:shadow-md transition cursor-pointer space-y-3"
              >
                {/* Header row: Category, Type badge, Status badge */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                      {item.category}
                    </span>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded border ${typeCfg.badge}`}>
                      {typeCfg.label}
                    </span>
                  </div>

                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusCfg.badgeClass}`}>
                    {statusCfg.label}
                  </span>
                </div>

                {/* Title and Short Description */}
                <div>
                  <h3 className="font-bold text-slate-900 text-base hover:text-blue-700 transition">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Returned revision note prompt if returned */}
                {item.status === 'returned' && item.manager_remarks && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-start space-x-2">
                    <RotateCcw className="w-3.5 h-3.5 text-rose-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block text-[11px]">Manager Revision Instructions:</span>
                      <span>{item.manager_remarks}</span>
                    </div>
                  </div>
                )}

                {/* Metadata Row: Submitter, Location, Date, Actions */}
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span className="font-medium text-slate-800">
                        {item.submitted_by_name || 'Member'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="truncate max-w-[200px]" title={item.location || item.region}>
                        {item.location ? `${item.location} (${item.region})` : item.region}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      <span>{formatPhilippineDate(item.activity_date)}</span>
                    </div>
                  </div>

                  {/* Contextual Action Buttons */}
                  <div className="flex items-center space-x-2">
                    {/* Member: Edit Returned */}
                    {isAuthor && item.status === 'returned' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEditInitiative(item);
                        }}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 font-semibold text-xs rounded-md border border-rose-300 flex items-center space-x-1 transition cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3 text-rose-700" />
                        <span>Revise</span>
                      </button>
                    )}

                    {/* Member: Submit Accomplishment if in_progress */}
                    {isAuthor && item.status === 'in_progress' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSubmitAccomplishment(item);
                        }}
                        className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold text-xs rounded-md border border-purple-300 flex items-center space-x-1 transition cursor-pointer"
                      >
                        <Award className="w-3 h-3 text-purple-700" />
                        <span>Submit Accomplishment</span>
                      </button>
                    )}

                    {/* Default Detail / Review Button */}
                    <button
                      type="button"
                      className="text-blue-700 hover:text-blue-900 font-semibold text-xs flex items-center space-x-1"
                    >
                      <span>{isManager ? 'View & Review' : 'View Details'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
