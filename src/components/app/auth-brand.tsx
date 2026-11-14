/**
 * Marca da Extend na entrada do sistema: a logo se revela da esquerda para a direita,
 * um brilho passa por ela e uma linha dourada se estende do centro para os lados.
 * Tudo em CSS (globals.css, .auth-brand); com "reduzir movimento" ligado, aparece parada.
 */
export function AuthBrand() {
  return (
    <div className="auth-brand" aria-hidden="true">
      <span className="auth-brand__logo">
        {/* eslint-disable-next-line @next/next/no-img-element -- a máscara do brilho usa o mesmo arquivo */}
        <img src="/brand/logo.png" alt="" width={553} height={108} />
        <span className="auth-brand__shine" />
      </span>
      <span className="auth-brand__line" />
    </div>
  );
}
