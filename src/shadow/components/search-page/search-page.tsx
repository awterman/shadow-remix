import { useEffect, useState } from "react";
import { Entry } from "shadow/contracts";
import { xxxBunddle } from "shadow/handlers/xxx";
import { Card } from "./card";
import tw from "tailwind-styled-components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";

const CardContainer = tw.div`
    p-8
    grid
    grid-cols-[repeat(auto-fill,20em)]
    auto-rows-18
    gap-12
    justify-center
`;

const SearchBar = tw.div`
    flex
    flex-row
    justify-center
    items-center

    relative

    py-4
    gap-4
`;

const Input = tw.input`
    w-[40%]
    py-2.5
    px-4

    rounded-md
    border-[0.5px]
    border-solid
    border-transparent
    border-black
    shadow-[0_2px_2px_rgba(0,0,0,0.5)]

    focus:outline-none
    focus:border-slate-400
`;

const Container = tw.div`
    flex
    flex-col
    content-center
`;

export const SearchPage = () => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [searchText, setSearchText] = useState<string>("");

  async function search() {
    const entries = await xxxBunddle.search(searchText);

    // limit to 20
    entries.length = 20;

    setEntries(entries);
  }

  useEffect(() => {
    search();
  }, []);

  return (
    <Container>
      <SearchBar>
        <Input
          className="bg-neutral-300"
          placeholder="Search..."
          onChange={(e) => {
            // TODO: immediate search
            setSearchText(e.target.value);
          }}
          onKeyUpCapture={(e) => e.key == "Enter" && search()}
        />
        <div>
          <FontAwesomeIcon
            className="absolute right-[calc(30%+1.5em)] top-8"
            icon={faSearch}
            onClick={search}
          />
        </div>
      </SearchBar>
      <CardContainer>
        {entries.map((entry, i) => (
          <Card entry={entry} key={i} />
        ))}
      </CardContainer>
    </Container>
  );
};
