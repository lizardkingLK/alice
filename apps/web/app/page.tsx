// export default function Home() {
//   return <div>HEello world</div>;
// }

import { SignInButton } from "@clerk/nextjs";

export default function HomePage() {
  return (
    <div>
      <h1>Welcome</h1>

      <SignInButton mode="modal">
        <button>Login</button>
      </SignInButton>
    </div>
  );
}