
// Hai người đại diện (họ tên, đơn vị) trên biên bản bàn giao, giao nhận tài sản.
import React from 'react';
import { Field, Input } from './ui';

const PeopleFields = ({ title, people, setPeople }) => (
  <fieldset className="rounded-md border border-rule-2 p-3">
    <legend className="px-1 text-[13px] font-medium text-ink-2">{title}</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      {people.map((p, i) => (
        <React.Fragment key={i}>
          <Field label={`${i + 1}. Ông (Bà)`}>
            <Input
              value={p.name}
              onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
          </Field>
          <Field label="Đơn vị">
            <Input
              value={p.unit}
              onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))}
            />
          </Field>
        </React.Fragment>
      ))}
    </div>
  </fieldset>
);

export default PeopleFields;
