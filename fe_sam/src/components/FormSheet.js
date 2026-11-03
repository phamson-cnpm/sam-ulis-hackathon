
// Vẽ một biểu mẫu (utils/forms.js) thành trang A4 để xem và in.
import React from 'react';
import './FormSheet.css';

const cls = (...c) => c.filter(Boolean).join(' ');

// Lưới nhãn, giá trị 4 cột như mẫu: nhãn | giá trị | nhãn | giá trị. Dòng một cặp thì giá trị trải 3 cột.
export const GRID_COLS = [19, 33, 22, 26];
export const GRID_COLS_WIDE = [29, 21, 29, 21];

const Grid = ({ rows, wide }) => (
  <table className="fs-grid">
    <colgroup>
      {(wide ? GRID_COLS_WIDE : GRID_COLS).map((w, i) => (
        <col key={i} style={{ width: `${w}%` }} />
      ))}
    </colgroup>
    <tbody>
      {rows.map((row, i) => (
        <tr key={i}>
          {row.length === 1 ? (
            <>
              <td className="fs-l">{row[0].label}</td>
              <td className={cls('fs-v', row[0].right && 'fs-r')} colSpan={3}>
                {row[0].value}
              </td>
            </>
          ) : (
            row.map((p, j) => (
              <React.Fragment key={j}>
                <td className="fs-l">{p.label}</td>
                <td className={cls('fs-v', p.right && 'fs-r')}>{p.value}</td>
              </React.Fragment>
            ))
          )}
        </tr>
      ))}
    </tbody>
  </table>
);

const DataTable = ({ cols, rows, foot, small }) => (
  <table className={cls('fs-table', small && 'fs-small')}>
    <colgroup>
      {cols.map((c, i) => (
        <col key={i} style={{ width: `${c.w}%` }} />
      ))}
    </colgroup>
    <thead>
      <tr>
        {cols.map((c, i) => (
          <th key={i}>{c.text}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => (
        <tr key={i}>
          {r.map((v, j) => (
            <td key={j} className={cls(cols[j]?.right && 'fs-r', cols[j]?.center && 'fs-c')}>
              {v}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
    {foot && (
      <tfoot>
        {foot.map((f, i) => (
          <tr key={i}>
            {f.cells.map((c, j) => (
              <td key={j} colSpan={c.span || 1} className={cls(c.right && 'fs-r', c.bold && 'fs-b')}>
                {c.text}
              </td>
            ))}
          </tr>
        ))}
      </tfoot>
    )}
  </table>
);

const Block = ({ b }) => {
  switch (b.t) {
    case 'section':
      return <div className={b.plain ? 'fs-sec-plain' : 'fs-sec'}>{b.text}</div>;
    case 'parties':
      return (
        <div className="fs-parties">
          {b.rows.map((r, i) => (
            <div key={i}>
              <span>{r.left}</span>
              <span>{r.right}</span>
            </div>
          ))}
        </div>
      );
    case 'grid':
      return <Grid rows={b.rows} wide={b.wide} />;
    case 'table':
      return <DataTable cols={b.cols} rows={b.rows} foot={b.foot} small={b.small} />;
    case 'note':
      return <p className="fs-note">{b.text}</p>;
    case 'para':
      return <p className={cls('fs-para', b.bold && 'fs-b')}>{b.text}</p>;
    default:
      return null;
  }
};

const FormSheet = ({ form, className, style }) => (
  <article className={cls('fs-paper', className)} style={style} aria-label={`${form.label} ${form.code}`}>
    {form.header === 'national' ? (
      <header className="fs-head fs-nat">
        <div className="fs-nat-l">
          <p>{form.org[0]}</p>
          <p className="fs-u fs-b">{form.org[1]}</p>
          <p className="fs-num">
            {form.numberLabel}: {form.code}
          </p>
        </div>
        <div className="fs-nat-r">
          <p className="fs-b">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
          <p className="fs-u fs-b">Độc lập - Tự do - Hạnh phúc</p>
          <p className="fs-i">{form.placeDate}</p>
        </div>
      </header>
    ) : (
      <header className="fs-head">
        <div className="fs-org">
          {form.org.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="fs-no">
          <span>{form.numberLabel}</span>
          {form.code}
        </div>
      </header>
    )}
    <h1 className="fs-title">{form.title}</h1>
    {form.subtitle && <p className="fs-sub">{form.subtitle}</p>}
    {form.blocks.map((b, i) => (
      <Block key={i} b={b} />
    ))}
    <div
      className="fs-sign"
      style={{
        gridTemplateColumns: `repeat(${Math.max(form.signatures.length, 2)}, minmax(0, 1fr))`,
      }}
    >
      {form.signatures.length === 1 && <div />}
      {form.signatures.map((s) => (
        <div key={s.title}>
          <p className="fs-st">{s.title}</p>
          <p className="fs-sn">(Ký, ghi rõ họ tên)</p>
          <p className="fs-name">{s.name || ' '}</p>
        </div>
      ))}
    </div>
    <p className="fs-foot">{form.footer}</p>
  </article>
);

export default FormSheet;
