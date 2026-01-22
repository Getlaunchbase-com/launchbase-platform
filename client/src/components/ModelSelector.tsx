import { useState, useMemo } from "react";
import { Star, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Model {
  id: string;
  label?: string;
  developer?: string;
  contextLength?: number;
  type?: string;
}

interface ModelSelectorProps {
  models: Model[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// localStorage key for favorites
const FAVORITES_KEY = "swarm.favoriteModels";

function getFavorites(): string[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites: string[]) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (e) {
    console.error("Failed to save favorites:", e);
  }
}

export function ModelSelector({
  models,
  value,
  onValueChange,
  placeholder = "Select model...",
  className,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>(getFavorites());

  const toggleFavorite = (modelId: string) => {
    const newFavorites = favorites.includes(modelId)
      ? favorites.filter((id) => id !== modelId)
      : [...favorites, modelId];
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
  };

  // Sort models: favorites first (alphabetically), then all others (alphabetically)
  const sortedModels = useMemo(() => {
    const favoriteModels = models.filter((m) => favorites.includes(m.id));
    const otherModels = models.filter((m) => !favorites.includes(m.id));

    const sortByLabel = (a: Model, b: Model) => {
      const aLabel = (a.label || a.id).toLowerCase();
      const bLabel = (b.label || b.id).toLowerCase();
      return aLabel.localeCompare(bLabel);
    };

    return {
      favorites: favoriteModels.sort(sortByLabel),
      others: otherModels.sort(sortByLabel),
    };
  }, [models, favorites]);

  // Filter by search
  const filteredFavorites = useMemo(
    () =>
      sortedModels.favorites.filter((m) => {
        const searchLower = search.toLowerCase();
        return (
          m.id.toLowerCase().includes(searchLower) ||
          m.label?.toLowerCase().includes(searchLower) ||
          m.developer?.toLowerCase().includes(searchLower)
        );
      }),
    [sortedModels.favorites, search]
  );

  const filteredOthers = useMemo(
    () =>
      sortedModels.others.filter((m) => {
        const searchLower = search.toLowerCase();
        return (
          m.id.toLowerCase().includes(searchLower) ||
          m.label?.toLowerCase().includes(searchLower) ||
          m.developer?.toLowerCase().includes(searchLower)
        );
      }),
    [sortedModels.others, search]
  );

  const selectedModel = models.find((m) => m.id === value);
  const displayValue = selectedModel
    ? selectedModel.label || selectedModel.id
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <span className="truncate">{displayValue}</span>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search models..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No models found.</CommandEmpty>

            {filteredFavorites.length > 0 && (
              <CommandGroup heading="⭐ Favorites">
                {filteredFavorites.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    onSelect={() => {
                      onValueChange(model.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex-1 truncate">
                      <div className="font-medium truncate">
                        {model.label || model.id}
                      </div>
                      {model.developer && (
                        <div className="text-xs text-muted-foreground">
                          {model.developer}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(model.id);
                      }}
                      className="ml-2 p-1 hover:bg-accent rounded"
                    >
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredOthers.length > 0 && (
              <CommandGroup heading={filteredFavorites.length > 0 ? "All Models (A-Z)" : "Models (A-Z)"}>
                {filteredOthers.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    onSelect={() => {
                      onValueChange(model.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex-1 truncate">
                      <div className="font-medium truncate">
                        {model.label || model.id}
                      </div>
                      {model.developer && (
                        <div className="text-xs text-muted-foreground">
                          {model.developer}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(model.id);
                      }}
                      className="ml-2 p-1 hover:bg-accent rounded"
                    >
                      <Star className="h-4 w-4 text-muted-foreground hover:text-yellow-400" />
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
