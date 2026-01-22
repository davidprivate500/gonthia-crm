'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { api } from '@/lib/api/client';
import { Users, Building2, Kanban, LayoutDashboard, Activity, Settings } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

interface SearchResult {
  id: string;
  displayName: string;
  email?: string;
  domain?: string;
  value?: string;
}

interface SearchResults {
  contacts: SearchResult[];
  companies: SearchResult[];
  deals: SearchResult[];
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ contacts: [], companies: [], deals: [] });
  const [isSearching, setIsSearching] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  // Keyboard shortcut to open
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Search when query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults({ contacts: [], companies: [], deals: [] });
      return;
    }

    const search = async () => {
      setIsSearching(true);
      try {
        const response = await api.search({ q: debouncedQuery, limit: 5 });
        const data = response.data as { grouped?: SearchResults } | undefined;
        if (data?.grouped) {
          setResults(data.grouped);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    search();
  }, [debouncedQuery]);

  const navigate = useCallback((path: string) => {
    setOpen(false);
    router.push(path);
  }, [router]);

  const quickActions = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Contacts', icon: Users, path: '/contacts' },
    { name: 'Companies', icon: Building2, path: '/companies' },
    { name: 'Pipeline', icon: Kanban, path: '/pipeline' },
    { name: 'Activities', icon: Activity, path: '/activities' },
    { name: 'Settings', icon: Settings, path: '/settings/profile' },
  ];

  const hasResults = results.contacts?.length > 0 || results.companies?.length > 0 || results.deals?.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search contacts, companies, deals..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? 'Searching...' : 'No results found.'}
        </CommandEmpty>

        {/* Quick Navigation */}
        {!query && (
          <CommandGroup heading="Quick Navigation">
            {quickActions.map((action) => (
              <CommandItem
                key={action.path}
                onSelect={() => navigate(action.path)}
              >
                <action.icon className="mr-2 h-4 w-4" />
                {action.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Search Results */}
        {hasResults && (
          <>
            {results.contacts?.length > 0 && (
              <CommandGroup heading="Contacts">
                {results.contacts.map((contact) => (
                  <CommandItem
                    key={contact.id}
                    onSelect={() => navigate(`/contacts/${contact.id}`)}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{contact.displayName}</span>
                      {contact.email && (
                        <span className="text-xs text-gray-500">{contact.email}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.companies?.length > 0 && (
              <CommandGroup heading="Companies">
                {results.companies.map((company) => (
                  <CommandItem
                    key={company.id}
                    onSelect={() => navigate(`/companies/${company.id}`)}
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{company.displayName}</span>
                      {company.domain && (
                        <span className="text-xs text-gray-500">{company.domain}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.deals?.length > 0 && (
              <CommandGroup heading="Deals">
                {results.deals.map((deal) => (
                  <CommandItem
                    key={deal.id}
                    onSelect={() => navigate(`/pipeline?deal=${deal.id}`)}
                  >
                    <Kanban className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{deal.displayName}</span>
                      {deal.value && !isNaN(Number(deal.value)) && (
                        <span className="text-xs text-gray-500">
                          ${Number(deal.value).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
