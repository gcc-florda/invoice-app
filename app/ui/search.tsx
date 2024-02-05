'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';

export default function Search({ placeholder }: { placeholder: string }) {

  const searchParams = useSearchParams(); // hook that lets you read the current URL's query string.
  // update the URL:
  const pathname = usePathname(); // gets the URL without the parameters --> /dashboard/invoices
  const { replace } = useRouter(); // function to modify the URL with a given string

  // wrap the contents of handleSearch, and only run the code after a specific time once the user has stopped typing (300ms)
  // Debouncing can reduce the number of requests sent to your database, thus saving resources.
  const handleSearch = useDebouncedCallback((term) => {
    console.log(`Searching... ${term}`);

    const params = new URLSearchParams(searchParams); // object that will let you modify the URL parameters

    params.set('page', '1');
    term ? params.set('query', term) : params.delete('query');
    replace(`${pathname}?${params.toString()}`);
  }, 300);

  return (
    <div className="relative flex flex-1 flex-shrink-0">
      <label htmlFor="search" className="sr-only">
        Search
      </label>
      <input
        className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
        placeholder={placeholder}
        onChange={(e) => {handleSearch(e.target.value);}}
        defaultValue={searchParams.get('query')?.toString()}
      />
      <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
    </div>
  );
}
