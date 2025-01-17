package edu.harvard.seas.pl.abcdatalog.engine;

/*-
 * #%L
 * AbcDatalog
 * %%
 * Copyright (C) 2016 - 2021 President and Fellows of Harvard College
 * %%
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 * 
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 * 
 * 3. Neither the name of the President and Fellows of Harvard College nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 * #L%
 */

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.Set;
import java.util.function.Supplier;

import org.junit.Test;

import edu.harvard.seas.pl.abcdatalog.ast.PositiveAtom;
import edu.harvard.seas.pl.abcdatalog.ast.validation.DatalogValidationException;

public abstract class ExplicitUnificationTests extends AbstractTests {

	public ExplicitUnificationTests(Supplier<DatalogEngine> engineFactory) {
		super(engineFactory);
	}
	
	@Test
	public void testRulesWithBinaryUnifiers() {
		String program = "tc(X,Y) :- edge(X,Y). tc(X,Y) :- edge(X,Z), tc(Z,Y)."
				+ "edge(a,b). edge(b,c). edge(c,c). edge(c,d)."
				+ "cycle(X) :- X = Y, tc(X,Y)."
				+ "beginsAtC(X,Y) :- tc(X,Y), c = X.";
		DatalogEngine engine = initEngine(program);
		Set<PositiveAtom> rs = engine.query(parseQuery("cycle(X)?"));
		assertEquals(rs.size(), 1);
		assertTrue(rs.containsAll(parseFacts("cycle(c).")));
		
		rs = engine.query(parseQuery("beginsAtC(X,Y)?"));
		assertEquals(rs.size(), 2);
		assertTrue(rs.containsAll(parseFacts("beginsAtC(c,c). beginsAtC(c,d).")));
	}
	
	@Test
	public void testRulesWithBinaryDisunifiers() {
		String program = "tc(X,Y) :- edge(X,Y). tc(X,Y) :- edge(X,Z), tc(Z,Y)."
				+ "edge(a,b). edge(b,c). edge(c,c). edge(c,d)."
				+ "noncycle(X,Y) :- X != Y, tc(X,Y)."
				+ "beginsNotAtC(X,Y) :- tc(X,Y), c != X."
				+ "noC(X,Y) :- edge(X,Y), X != c, Y != c."
				+ "noC(X,Y) :- noC(X,Z), noC(Z,Y).";
		DatalogEngine engine = initEngine(program);
		Set<PositiveAtom> rs = engine.query(parseQuery("noncycle(X,Y)?"));
		assertEquals(rs.size(), 6);
		assertTrue(rs.containsAll(parseFacts("noncycle(a,b). noncycle(a,c)."
				+ "noncycle(a,d). noncycle(b,c). noncycle(b,d). noncycle(c,d).")));
		
		rs = engine.query(parseQuery("beginsNotAtC(X,Y)?"));
		assertEquals(rs.size(), 5);
		assertTrue(rs.containsAll(parseFacts("beginsNotAtC(a,b). beginsNotAtC(a,c)."
				+ "beginsNotAtC(a,d). beginsNotAtC(b,c). beginsNotAtC(b,d).")));
		
		rs = engine.query(parseQuery("noC(X,Y)?"));
		assertEquals(rs.size(), 1);
		assertTrue(rs.containsAll(parseFacts("noC(a,b).")));
	}
	
	@Test
	public void testBinaryUnificationNoAtom() throws DatalogValidationException {
		String program = "p(X,b) :- X=a. p(b,Y) :- Y=a. p(X,Y) :- X=c, Y=d. p(X,X) :- X=c. p(X,Y) :- X=d, Y=X. p(X,Y) :- X=Y, X=e.";
		String expected = "p(a,b). p(b,a). p(c,d). p(c,c). p(d,d). p(e,e).";
		test(program, "p(X,Y)?", expected);
		
		program += "q(X,Y) :- p(X,Y).";
		expected = "q(a,b). q(b,a). q(c,d). q(c,c). q(d,d). q(e,e).";
		test(program, "q(X,Y)?", expected);
	}
	
	@Test(expected = DatalogValidationException.class)
	public void testUselessBinaryUnification() throws DatalogValidationException {
		test("p(X) :- q(X), X=Y. q(a). p(b) :- X=_.", "p(X)?", "p(a). p(b).");
	}
	
	public void testImpossibleBinaryUnification1() throws DatalogValidationException {
		test("p :- a=b.", "p?", "");
	}
	
	public void testImpossibleBinaryUnification2() throws DatalogValidationException {
		test("p :- Z=b, X=Y, a=X, Z=Y.", "p?", "");
	}
	
	@Test
	public void testBinaryDisunificationNoAtom() throws DatalogValidationException {
		String program = "p :- a!=b. q :- X!=Y, X=a, Y=b.";
		test(program, "p?", "p.");
		test(program, "q?", "q.");
	}
	
	public void testImpossibleBinaryDisunification1() throws DatalogValidationException {
		test("p :- a!=a.", "p?", "");
	}
	
	public void testImpossibleBinaryDisunification2() throws DatalogValidationException {
		test("p :- Z=a, X!=Y, a=X, Z=Y.", "p?", "");
	}
	
	public void testImpossibleBinaryDisunification3() throws DatalogValidationException {
		test("p :- q(X), X!=X.", "p?", "");
	}
	
	@Test(expected = DatalogValidationException.class)
	public void testBinaryDisunificationFail1() throws DatalogValidationException {
		test("p :- not q(a,b), X!=_.", "p?", "");
	}
	
	@Test(expected = DatalogValidationException.class)
	public void testBinaryDisunificationFail2() throws DatalogValidationException {
		test("p(X) :- q(X), Y!=_. q(a).", "p(X)?", "");
		throw new DatalogValidationException();
	}

}
