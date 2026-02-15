export const FilterChip = ({ label, onRemove }) => (
  <div class="filter-chip">
    <span>{label}</span>
    <button class="filter-chip-remove" onClick={onRemove} type="button">×</button>
  </div>
)
